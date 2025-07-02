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
exports.addBillingBatchJob = addBillingBatchJob;
exports.triggerImmediateBillingProcess = triggerImmediateBillingProcess;
const logger_1 = require("../../lib/logger");
const queue_service_1 = require("../queue-service");
const uuid_1 = require("uuid");
const Sentry = __importStar(require("@sentry/node"));
/**
 * Adds a job to the billing queue to trigger batch processing
 * This can be used when we want to ensure billing is processed without waiting for the next interval
 */
async function addBillingBatchJob() {
    try {
        const jobId = (0, uuid_1.v4)();
        logger_1.logger.info("Adding billing batch job to queue", { jobId });
        await (0, queue_service_1.getBillingQueue)().add("process-batch", {
            timestamp: new Date().toISOString(),
        }, {
            jobId,
            priority: 10,
        });
        return { success: true, jobId };
    }
    catch (error) {
        logger_1.logger.error("Error adding billing batch job", { error });
        Sentry.captureException(error, {
            data: {
                operation: "add_billing_batch_job"
            }
        });
        return { success: false, error };
    }
}
/**
 * Trigger immediate processing of any pending billing operations
 * This is useful for ensuring billing operations are processed without delay
 */
async function triggerImmediateBillingProcess() {
    try {
        return await addBillingBatchJob();
    }
    catch (error) {
        logger_1.logger.error("Error triggering immediate billing process", { error });
        return { success: false, error };
    }
}
//# sourceMappingURL=queue-billing.js.map