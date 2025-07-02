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
exports.crawlJobStatusPreviewController = crawlJobStatusPreviewController;
const logger_1 = require("../../../src/lib/logger");
const crawl_redis_1 = require("../../../src/lib/crawl-redis");
const crawl_status_1 = require("./crawl-status");
const Sentry = __importStar(require("@sentry/node"));
async function crawlJobStatusPreviewController(req, res) {
    try {
        const sc = await (0, crawl_redis_1.getCrawl)(req.params.jobId);
        if (!sc) {
            return res.status(404).json({ error: "Job not found" });
        }
        const jobIDs = await (0, crawl_redis_1.getCrawlJobs)(req.params.jobId);
        // let data = job.returnvalue;
        // if (process.env.USE_DB_AUTHENTICATION === "true") {
        //   const supabaseData = await supabaseGetJobById(req.params.jobId);
        //   if (supabaseData) {
        //     data = supabaseData.docs;
        //   }
        // }
        const jobs = (await (0, crawl_status_1.getJobs)(req.params.jobId, jobIDs)).sort((a, b) => a.timestamp - b.timestamp);
        const jobStatuses = await Promise.all(jobs.map((x) => x.getState()));
        const jobStatus = sc.cancelled
            ? "failed"
            : jobStatuses.every((x) => x === "completed")
                ? "completed"
                : jobStatuses.some((x) => x === "failed")
                    ? "failed"
                    : "active";
        const data = jobs.map((x) => Array.isArray(x.returnvalue) ? x.returnvalue[0] : x.returnvalue);
        res.json({
            status: jobStatus,
            current: jobStatuses.filter((x) => x === "completed" || x === "failed")
                .length,
            total: jobs.length,
            data: jobStatus === "completed" ? data : null,
            partial_data: jobStatus === "completed" ? [] : data.filter((x) => x !== null),
        });
    }
    catch (error) {
        Sentry.captureException(error);
        logger_1.logger.error(error);
        return res.status(500).json({ error: error.message });
    }
}
//# sourceMappingURL=status.js.map