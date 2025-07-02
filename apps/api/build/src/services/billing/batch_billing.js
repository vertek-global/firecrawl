"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBillingBatch = processBillingBatch;
exports.startBillingBatchProcessing = startBillingBatchProcessing;
exports.queueBillingOperation = queueBillingOperation;
const logger_1 = require("../../lib/logger");
const queue_service_1 = require("../queue-service");
const supabase_1 = require("../supabase");
const Sentry = __importStar(require("@sentry/node"));
const withAuth_1 = require("../../lib/withAuth");
const auth_1 = require("../../controllers/auth");
// Configuration constants
const BATCH_KEY = "billing_batch";
const BATCH_LOCK_KEY = "billing_batch_lock";
const BATCH_SIZE = 100; // Batch size for processing
const BATCH_TIMEOUT = 15000; // 15 seconds processing interval
const LOCK_TIMEOUT = 30000; // 30 seconds lock timeout
// Function to acquire a lock for batch processing
async function acquireLock() {
    const redis = queue_service_1.redisConnection;
    // Set lock with NX (only if it doesn't exist) and PX (millisecond expiry)
    const result = await redis.set(BATCH_LOCK_KEY, "1", "PX", LOCK_TIMEOUT, "NX");
    const acquired = result === "OK";
    if (acquired) {
        logger_1.logger.info("🔒 Acquired billing batch processing lock");
    }
    return acquired;
}
// Function to release the lock
async function releaseLock() {
    const redis = queue_service_1.redisConnection;
    await redis.del(BATCH_LOCK_KEY);
    logger_1.logger.info("🔓 Released billing batch processing lock");
}
// Main function to process the billing batch
async function processBillingBatch() {
    const redis = queue_service_1.redisConnection;
    // Try to acquire lock
    if (!(await acquireLock())) {
        return;
    }
    try {
        // Get all operations from Redis list
        const operations = [];
        while (operations.length < BATCH_SIZE) {
            const op = await redis.lpop(BATCH_KEY);
            if (!op)
                break;
            operations.push(JSON.parse(op));
        }
        if (operations.length === 0) {
            logger_1.logger.info("No billing operations to process in batch");
            return;
        }
        logger_1.logger.info(`📦 Processing batch of ${operations.length} billing operations`);
        // Group operations by team_id and subscription_id
        const groupedOperations = new Map();
        for (const op of operations) {
            const key = `${op.team_id}:${op.subscription_id ?? 'null'}:${op.is_extract}`;
            if (!groupedOperations.has(key)) {
                groupedOperations.set(key, {
                    team_id: op.team_id,
                    subscription_id: op.subscription_id,
                    total_credits: 0,
                    is_extract: op.is_extract,
                    operations: []
                });
            }
            const group = groupedOperations.get(key);
            group.total_credits += op.credits;
            group.operations.push(op);
        }
        // Process each group of operations
        for (const [key, group] of groupedOperations.entries()) {
            logger_1.logger.info(`🔄 Billing team ${group.team_id} for ${group.total_credits} credits`, {
                team_id: group.team_id,
                subscription_id: group.subscription_id,
                total_credits: group.total_credits,
                operation_count: group.operations.length,
                is_extract: group.is_extract
            });
            // Skip billing for preview teams
            if (group.team_id === "preview" || group.team_id.startsWith("preview_")) {
                logger_1.logger.info(`Skipping billing for preview team ${group.team_id}`);
                continue;
            }
            try {
                // Execute the actual billing
                await (0, withAuth_1.withAuth)(supaBillTeam, { success: true, message: "No DB, bypassed." })(group.team_id, group.subscription_id, group.total_credits, logger_1.logger, group.is_extract);
                logger_1.logger.info(`✅ Successfully billed team ${group.team_id} for ${group.total_credits} ${group.is_extract ? 'tokens' : 'credits'}`);
            }
            catch (error) {
                logger_1.logger.error(`❌ Failed to bill team ${group.team_id}`, { error, group });
                Sentry.captureException(error, {
                    data: {
                        operation: "batch_billing",
                        team_id: group.team_id,
                        credits: group.total_credits
                    }
                });
            }
        }
        logger_1.logger.info("✅ Billing batch processing completed successfully");
    }
    catch (error) {
        logger_1.logger.error("Error processing billing batch", { error });
        Sentry.captureException(error, {
            data: {
                operation: "batch_billing_process"
            }
        });
    }
    finally {
        await releaseLock();
    }
}
// Start periodic batch processing
let batchInterval = null;
function startBillingBatchProcessing() {
    if (batchInterval)
        return;
    logger_1.logger.info("🔄 Starting periodic billing batch processing");
    batchInterval = setInterval(async () => {
        const queueLength = await queue_service_1.redisConnection.llen(BATCH_KEY);
        logger_1.logger.info(`Checking billing batch queue (${queueLength} items pending)`);
        await processBillingBatch();
    }, BATCH_TIMEOUT);
    // Unref to not keep process alive
    batchInterval.unref();
}
// Add a billing operation to the queue
async function queueBillingOperation(team_id, subscription_id, credits, is_extract = false) {
    // Skip queuing for preview teams
    if (team_id === "preview" || team_id.startsWith("preview_")) {
        logger_1.logger.info(`Skipping billing queue for preview team ${team_id}`);
        return { success: true, message: "Preview team, no credits used" };
    }
    logger_1.logger.info(`Queueing billing operation for team ${team_id}`, {
        team_id,
        subscription_id,
        credits,
        is_extract
    });
    try {
        const operation = {
            team_id,
            subscription_id: subscription_id ?? null,
            credits,
            is_extract,
            timestamp: new Date().toISOString()
        };
        // Add operation to Redis list
        const redis = queue_service_1.redisConnection;
        await redis.rpush(BATCH_KEY, JSON.stringify(operation));
        const queueLength = await redis.llen(BATCH_KEY);
        logger_1.logger.info(`📥 Added billing operation to queue (${queueLength} total pending)`, {
            team_id,
            credits
        });
        // Start batch processing if not already started
        startBillingBatchProcessing();
        // If we have enough items, trigger immediate processing
        if (queueLength >= BATCH_SIZE) {
            logger_1.logger.info("🔄 Billing queue reached batch size, triggering immediate processing");
            await processBillingBatch();
        }
        // TODO is there a better way to do this?
        // Update cached credits used immediately to provide accurate feedback to users
        // This is optimistic - actual billing happens in batch
        // Should we add this?
        // I guess batch is fast enough that it's fine
        // if (process.env.USE_DB_AUTHENTICATION === "true") {
        //   (async () => {
        //     // Get API keys for this team to update in cache
        //     const { data } = await supabase_service
        //       .from("api_keys")
        //       .select("key")
        //       .eq("team_id", team_id);
        //     for (const apiKey of (data ?? []).map(x => x.key)) {
        //       await setCachedACUC(apiKey, (acuc) =>
        //         acuc
        //           ? {
        //               ...acuc,
        //               credits_used: acuc.credits_used + credits,
        //               adjusted_credits_used: acuc.adjusted_credits_used + credits,
        //               remaining_credits: acuc.remaining_credits - credits,
        //             }
        //           : null,
        //       );
        //     }
        //   })().catch(error => {
        //     logger.error("Failed to update cached credits", { error, team_id });
        //   });
        // }
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error("Error queueing billing operation", { error, team_id });
        Sentry.captureException(error, {
            data: {
                operation: "queue_billing",
                team_id,
                credits
            }
        });
        return { success: false, error };
    }
}
// Modified version of the billing function for batch operations
async function supaBillTeam(team_id, subscription_id, credits, __logger, is_extract = false) {
    const _logger = (__logger ?? logger_1.logger).child({
        module: "credit_billing",
        method: "supaBillTeam",
        teamId: team_id,
        subscriptionId: subscription_id,
        credits,
    });
    if (team_id === "preview" || team_id.startsWith("preview_")) {
        return { success: true, message: "Preview team, no credits used" };
    }
    _logger.info(`Batch billing team ${team_id} for ${credits} credits`);
    // Perform the actual database operation
    const { data, error } = await supabase_1.supabase_service.rpc("bill_team_4_tally", {
        _team_id: team_id,
        sub_id: subscription_id ?? null,
        fetch_subscription: subscription_id === undefined,
        credits,
        is_extract_param: is_extract,
    });
    if (error) {
        Sentry.captureException(error);
        _logger.error("Failed to bill team.", { error });
        return { success: false, error };
    }
    // Update cached ACUC to reflect the new credit usage
    (async () => {
        for (const apiKey of (data ?? []).map((x) => x.api_key)) {
            await (0, auth_1.setCachedACUC)(apiKey, is_extract, (acuc) => acuc
                ? {
                    ...acuc,
                    credits_used: acuc.credits_used + credits,
                    adjusted_credits_used: acuc.adjusted_credits_used + credits,
                    remaining_credits: acuc.remaining_credits - credits,
                }
                : null);
            await (0, auth_1.setCachedACUCTeam)(team_id, is_extract, (acuc) => acuc
                ? {
                    ...acuc,
                    credits_used: acuc.credits_used + credits,
                    adjusted_credits_used: acuc.adjusted_credits_used + credits,
                    remaining_credits: acuc.remaining_credits - credits,
                }
                : null);
        }
    })().catch(error => {
        _logger.error("Failed to update cached credits", { error, team_id });
    });
    return { success: true, data };
}
// Cleanup on exit
process.on("beforeExit", async () => {
    if (batchInterval) {
        clearInterval(batchInterval);
        batchInterval = null;
        logger_1.logger.info("Stopped periodic billing batch processing");
    }
    await processBillingBatch();
});
//# sourceMappingURL=batch_billing.js.map