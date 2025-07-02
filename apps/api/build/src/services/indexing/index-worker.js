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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("../sentry");
const Sentry = __importStar(require("@sentry/node"));
const bullmq_1 = require("bullmq");
const logger_1 = require("../../lib/logger");
const queue_service_1 = require("../queue-service");
const batch_billing_1 = require("../billing/batch_billing");
const system_monitor_1 = __importDefault(require("../system-monitor"));
const uuid_1 = require("uuid");
const __1 = require("..");
const webhook_1 = require("../webhook");
const workerLockDuration = Number(process.env.WORKER_LOCK_DURATION) || 60000;
const workerStalledCheckInterval = Number(process.env.WORKER_STALLED_CHECK_INTERVAL) || 30000;
const jobLockExtendInterval = Number(process.env.JOB_LOCK_EXTEND_INTERVAL) || 15000;
const jobLockExtensionTime = Number(process.env.JOB_LOCK_EXTENSION_TIME) || 60000;
const cantAcceptConnectionInterval = Number(process.env.CANT_ACCEPT_CONNECTION_INTERVAL) || 2000;
const connectionMonitorInterval = Number(process.env.CONNECTION_MONITOR_INTERVAL) || 10;
const gotJobInterval = Number(process.env.CONNECTION_MONITOR_INTERVAL) || 20;
const runningJobs = new Set();
// Create a processor for billing jobs
const processBillingJobInternal = async (token, job) => {
    if (!job.id) {
        throw new Error("Job has no ID");
    }
    const logger = logger_1.logger.child({
        module: "billing-worker",
        method: "processBillingJobInternal",
        jobId: job.id,
    });
    const extendLockInterval = setInterval(async () => {
        logger.info(`🔄 Worker extending lock on billing job ${job.id}`);
        await job.extendLock(token, jobLockExtensionTime);
    }, jobLockExtendInterval);
    let err = null;
    try {
        // Check job type - it could be either a batch processing trigger or an individual billing operation
        if (job.name === "process-batch") {
            // Process the entire batch
            logger.info("Received batch process trigger job");
            await (0, batch_billing_1.processBillingBatch)();
        }
        else if (job.name === "bill_team") {
            // This is an individual billing operation that should be queued for batch processing
            const { team_id, subscription_id, credits, is_extract } = job.data;
            logger.info(`Adding team ${team_id} billing operation to batch queue`, {
                credits,
                is_extract,
                originating_job_id: job.data.originating_job_id,
            });
            // Add to the REDIS batch queue 
            await (0, batch_billing_1.queueBillingOperation)(team_id, subscription_id, credits, is_extract);
        }
        else {
            logger.warn(`Unknown billing job type: ${job.name}`);
        }
        await job.moveToCompleted({ success: true }, token, false);
    }
    catch (error) {
        logger.error("Error processing billing job", { error });
        Sentry.captureException(error);
        err = error;
        await job.moveToFailed(error, token, false);
    }
    finally {
        clearInterval(extendLockInterval);
    }
    return err;
};
let isShuttingDown = false;
process.on("SIGINT", () => {
    logger_1.logger.info("Received SIGTERM. Shutting down gracefully...");
    isShuttingDown = true;
});
process.on("SIGTERM", () => {
    logger_1.logger.info("Received SIGTERM. Shutting down gracefully...");
    isShuttingDown = true;
});
let cantAcceptConnectionCount = 0;
// Generic worker function that can process different job types
const workerFun = async (queue, jobProcessor) => {
    const logger = logger_1.logger.child({ module: "index-worker", method: "workerFun" });
    const worker = new bullmq_1.Worker(queue.name, null, {
        connection: queue_service_1.redisConnection,
        lockDuration: workerLockDuration,
        stalledInterval: workerStalledCheckInterval,
        maxStalledCount: 10,
    });
    worker.startStalledCheckTimer();
    const monitor = await system_monitor_1.default;
    while (true) {
        if (isShuttingDown) {
            logger.info("No longer accepting new jobs. SIGINT");
            break;
        }
        const token = (0, uuid_1.v4)();
        const canAcceptConnection = await monitor.acceptConnection();
        if (!canAcceptConnection) {
            console.log("Can't accept connection due to RAM/CPU load");
            logger.info("Can't accept connection due to RAM/CPU load");
            cantAcceptConnectionCount++;
            if (cantAcceptConnectionCount >= 25) {
                logger.error("WORKER STALLED", {
                    cpuUsage: await monitor.checkCpuUsage(),
                    memoryUsage: await monitor.checkMemoryUsage(),
                });
            }
            await new Promise((resolve) => setTimeout(resolve, cantAcceptConnectionInterval));
            continue;
        }
        else {
            cantAcceptConnectionCount = 0;
        }
        const job = await worker.getNextJob(token);
        if (job) {
            if (job.id) {
                runningJobs.add(job.id);
            }
            if (job.data && job.data.sentry && Sentry.isInitialized()) {
                Sentry.continueTrace({
                    sentryTrace: job.data.sentry.trace,
                    baggage: job.data.sentry.baggage,
                }, () => {
                    Sentry.startSpan({
                        name: "Index job",
                        attributes: {
                            job: job.id,
                            worker: process.env.FLY_MACHINE_ID ?? worker.id,
                        },
                    }, async () => {
                        await jobProcessor(token, job);
                    });
                });
            }
            else {
                await jobProcessor(token, job);
            }
            if (job.id) {
                runningJobs.delete(job.id);
            }
            await new Promise((resolve) => setTimeout(resolve, gotJobInterval));
        }
        else {
            await new Promise((resolve) => setTimeout(resolve, connectionMonitorInterval));
        }
    }
    logger.info("Worker loop ended. Waiting for running jobs to finish...");
    while (runningJobs.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    logger.info("All jobs finished. Worker exiting!");
    process.exit(0);
};
const INDEX_INSERT_INTERVAL = 15000;
const WEBHOOK_INSERT_INTERVAL = 15000;
// Start the workers
(async () => {
    // Start billing worker and batch processing
    (0, batch_billing_1.startBillingBatchProcessing)();
    const billingWorkerPromise = workerFun((0, queue_service_1.getBillingQueue)(), processBillingJobInternal);
    const indexInserterInterval = setInterval(async () => {
        if (isShuttingDown) {
            return;
        }
        await (0, __1.processIndexInsertJobs)();
    }, INDEX_INSERT_INTERVAL);
    const webhookInserterInterval = setInterval(async () => {
        if (isShuttingDown) {
            return;
        }
        await (0, webhook_1.processWebhookInsertJobs)();
    }, WEBHOOK_INSERT_INTERVAL);
    // Wait for all workers to complete (which should only happen on shutdown)
    await Promise.all([billingWorkerPromise]);
    clearInterval(indexInserterInterval);
    clearInterval(webhookInserterInterval);
})();
//# sourceMappingURL=index-worker.js.map