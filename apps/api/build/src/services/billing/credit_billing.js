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
exports.billTeam = billTeam;
exports.supaBillTeam = supaBillTeam;
exports.checkTeamCredits = checkTeamCredits;
exports.supaCheckTeamCredits = supaCheckTeamCredits;
exports.countCreditsAndRemainingForCurrentBillingPeriod = countCreditsAndRemainingForCurrentBillingPeriod;
const types_1 = require("../../types");
const withAuth_1 = require("../../lib/withAuth");
const email_notification_1 = require("../notification/email_notification");
const supabase_1 = require("../supabase");
const logger_1 = require("../../lib/logger");
const Sentry = __importStar(require("@sentry/node"));
const auto_charge_1 = require("./auto_charge");
const redis_1 = require("../redis");
const batch_billing_1 = require("./batch_billing");
// Deprecated, done via rpc
const FREE_CREDITS = 500;
/**
 * If you do not know the subscription_id in the current context, pass subscription_id as undefined.
 */
async function billTeam(team_id, subscription_id, credits, logger, is_extract = false) {
    // Maintain the withAuth wrapper for authentication
    return (0, withAuth_1.withAuth)(async (team_id, subscription_id, credits, logger, is_extract) => {
        // Within the authenticated context, queue the billing operation
        return (0, batch_billing_1.queueBillingOperation)(team_id, subscription_id, credits, is_extract);
    }, { success: true, message: "No DB, bypassed." })(team_id, subscription_id, credits, logger, is_extract);
}
async function supaBillTeam(team_id, subscription_id, credits, __logger, is_extract = false) {
    // This function should no longer be called directly
    // It has been moved to batch_billing.ts
    const _logger = (__logger ?? logger_1.logger).child({
        module: "credit_billing",
        method: "supaBillTeam",
        teamId: team_id,
        subscriptionId: subscription_id,
        credits,
    });
    _logger.warn("supaBillTeam was called directly. This function is deprecated and should only be called from batch_billing.ts");
    (0, batch_billing_1.queueBillingOperation)(team_id, subscription_id, credits, is_extract).catch((err) => {
        _logger.error("Error queuing billing operation", { err });
        Sentry.captureException(err);
    });
    // Forward to the batch billing system
    return {
        success: true,
        message: "Billing operation queued",
    };
}
async function checkTeamCredits(chunk, team_id, credits) {
    return (0, withAuth_1.withAuth)(supaCheckTeamCredits, {
        success: true,
        message: "No DB, bypassed",
        remainingCredits: Infinity,
    })(chunk, team_id, credits);
}
// if team has enough credits for the operation, return true, else return false
async function supaCheckTeamCredits(chunk, team_id, credits) {
    // WARNING: chunk will be null if team_id is preview -- do not perform operations on it under ANY circumstances - mogery
    if (team_id === "preview" || team_id.startsWith("preview_")) {
        return {
            success: true,
            message: "Preview team, no credits used",
            remainingCredits: Infinity,
        };
    }
    else if (chunk === null) {
        throw new Error("NULL ACUC passed to supaCheckTeamCredits");
    }
    const creditsWillBeUsed = chunk.adjusted_credits_used + credits;
    // In case chunk.price_credits is undefined, set it to a large number to avoid mistakes
    const totalPriceCredits = chunk.total_credits_sum ?? 100000000;
    // Removal of + credits
    const creditUsagePercentage = chunk.adjusted_credits_used / totalPriceCredits;
    let isAutoRechargeEnabled = false, autoRechargeThreshold = 1000;
    const cacheKey = `team_auto_recharge_${team_id}`;
    let cachedData = await (0, redis_1.getValue)(cacheKey);
    if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        isAutoRechargeEnabled = parsedData.auto_recharge;
        autoRechargeThreshold = parsedData.auto_recharge_threshold;
    }
    else {
        const { data, error } = await supabase_1.supabase_rr_service
            .from("teams")
            .select("auto_recharge, auto_recharge_threshold")
            .eq("id", team_id)
            .single();
        if (data) {
            isAutoRechargeEnabled = data.auto_recharge;
            autoRechargeThreshold = data.auto_recharge_threshold;
            await (0, redis_1.setValue)(cacheKey, JSON.stringify(data), 300); // Cache for 5 minutes (300 seconds)
        }
    }
    if (isAutoRechargeEnabled &&
        chunk.remaining_credits < autoRechargeThreshold &&
        !chunk.is_extract) {
        logger_1.logger.info("Auto-recharge triggered", {
            team_id,
            teamId: team_id,
            autoRechargeThreshold,
            remainingCredits: chunk.remaining_credits,
        });
        const autoChargeResult = await (0, auto_charge_1.autoCharge)(chunk, autoRechargeThreshold);
        if (autoChargeResult.success) {
            return {
                success: true,
                message: autoChargeResult.message,
                remainingCredits: autoChargeResult.remainingCredits,
                chunk: autoChargeResult.chunk,
            };
        }
    }
    // Compare the adjusted total credits used with the credits allowed by the plan
    if (creditsWillBeUsed > totalPriceCredits) {
        // Only notify if their actual credits (not what they will use) used is greater than the total price credits
        if (chunk.adjusted_credits_used > totalPriceCredits) {
            (0, email_notification_1.sendNotification)(team_id, types_1.NotificationType.LIMIT_REACHED, chunk.sub_current_period_start, chunk.sub_current_period_end, chunk);
        }
        return {
            success: false,
            message: "Insufficient credits to perform this request. For more credits, you can upgrade your plan at https://firecrawl.dev/pricing.",
            remainingCredits: chunk.remaining_credits,
            chunk,
        };
    }
    else if (creditUsagePercentage >= 0.8 && creditUsagePercentage < 1) {
        // Send email notification for approaching credit limit
        (0, email_notification_1.sendNotification)(team_id, types_1.NotificationType.APPROACHING_LIMIT, chunk.sub_current_period_start, chunk.sub_current_period_end, chunk);
    }
    return {
        success: true,
        message: "Sufficient credits available",
        remainingCredits: chunk.remaining_credits,
        chunk,
    };
}
// Count the total credits used by a team within the current billing period and return the remaining credits.
async function countCreditsAndRemainingForCurrentBillingPeriod(team_id) {
    // 1. Retrieve the team's active subscription based on the team_id.
    const { data: subscription, error: subscriptionError } = await supabase_1.supabase_service
        .from("subscriptions")
        .select("id, price_id, current_period_start, current_period_end")
        .eq("team_id", team_id)
        .single();
    const { data: coupons } = await supabase_1.supabase_service
        .from("coupons")
        .select("credits")
        .eq("team_id", team_id)
        .eq("status", "active");
    let couponCredits = 0;
    if (coupons && coupons.length > 0) {
        couponCredits = coupons.reduce((total, coupon) => total + coupon.credits, 0);
    }
    if (subscriptionError || !subscription) {
        // Free
        const { data: creditUsages, error: creditUsageError } = await supabase_1.supabase_service
            .from("credit_usage")
            .select("credits_used")
            .is("subscription_id", null)
            .eq("team_id", team_id);
        if (creditUsageError || !creditUsages) {
            throw new Error(`Failed to retrieve credit usage for team_id: ${team_id}`);
        }
        const totalCreditsUsed = creditUsages.reduce((acc, usage) => acc + usage.credits_used, 0);
        const remainingCredits = FREE_CREDITS + couponCredits - totalCreditsUsed;
        return {
            totalCreditsUsed: totalCreditsUsed,
            remainingCredits,
            totalCredits: FREE_CREDITS + couponCredits,
        };
    }
    const { data: creditUsages, error: creditUsageError } = await supabase_1.supabase_service
        .from("credit_usage")
        .select("credits_used")
        .eq("subscription_id", subscription.id)
        .gte("created_at", subscription.current_period_start)
        .lte("created_at", subscription.current_period_end);
    if (creditUsageError || !creditUsages) {
        throw new Error(`Failed to retrieve credit usage for subscription_id: ${subscription.id}`);
    }
    const totalCreditsUsed = creditUsages.reduce((acc, usage) => acc + usage.credits_used, 0);
    const { data: price, error: priceError } = await supabase_1.supabase_service
        .from("prices")
        .select("credits")
        .eq("id", subscription.price_id)
        .single();
    if (priceError || !price) {
        throw new Error(`Failed to retrieve price for price_id: ${subscription.price_id}`);
    }
    const remainingCredits = price.credits + couponCredits - totalCreditsUsed;
    return {
        totalCreditsUsed,
        remainingCredits,
        totalCredits: price.credits,
    };
}
//# sourceMappingURL=credit_billing.js.map