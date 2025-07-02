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
exports.crawlStatusWSController = crawlStatusWSController;
const types_1 = require("../../types");
const auth_1 = require("../auth");
const uuid_1 = require("uuid");
const logger_1 = require("../../lib/logger");
const crawl_redis_1 = require("../../lib/crawl-redis");
const queue_service_1 = require("../../services/queue-service");
const crawl_status_1 = require("./crawl-status");
const Sentry = __importStar(require("@sentry/node"));
const concurrency_limit_1 = require("../../lib/concurrency-limit");
function send(ws, msg) {
    if (ws.readyState === 1) {
        return new Promise((resolve, reject) => {
            ws.send(JSON.stringify(msg), (err) => {
                if (err)
                    reject(err);
                else
                    resolve(null);
            });
        });
    }
}
function close(ws, code, msg) {
    if (ws.readyState <= 1) {
        ws.close(code, JSON.stringify(msg));
    }
}
async function crawlStatusWS(ws, req) {
    const sc = await (0, crawl_redis_1.getCrawl)(req.params.jobId);
    if (!sc) {
        return close(ws, 1008, { type: "error", error: "Job not found" });
    }
    if (sc.team_id !== req.auth.team_id) {
        return close(ws, 3003, { type: "error", error: "Forbidden" });
    }
    let doneJobIDs = [];
    let finished = false;
    const loop = async () => {
        if (finished)
            return;
        const jobIDs = await (0, crawl_redis_1.getCrawlJobs)(req.params.jobId);
        if (jobIDs.length === doneJobIDs.length) {
            return close(ws, 1000, { type: "done" });
        }
        const notDoneJobIDs = jobIDs.filter((x) => !doneJobIDs.includes(x));
        const jobStatuses = await Promise.all(notDoneJobIDs.map(async (x) => [
            x,
            await (0, queue_service_1.getScrapeQueue)().getJobState(x),
        ]));
        const newlyDoneJobIDs = jobStatuses
            .filter((x) => x[1] === "completed" || x[1] === "failed")
            .map((x) => x[0]);
        const newlyDoneJobs = (await Promise.all(newlyDoneJobIDs.map((x) => (0, crawl_status_1.getJob)(x)))).filter((x) => x !== undefined);
        for (const job of newlyDoneJobs) {
            if (job.returnvalue) {
                send(ws, {
                    type: "document",
                    data: job.returnvalue,
                });
            }
            else {
                // Crawl errors are ignored.
            }
        }
        doneJobIDs.push(...newlyDoneJobIDs);
        setTimeout(loop, 1000);
    };
    setTimeout(loop, 1000);
    doneJobIDs = await (0, crawl_redis_1.getDoneJobsOrdered)(req.params.jobId);
    let jobIDs = await (0, crawl_redis_1.getCrawlJobs)(req.params.jobId);
    let jobStatuses = await Promise.all(jobIDs.map(async (x) => [x, await (0, queue_service_1.getScrapeQueue)().getJobState(x)]));
    const throttledJobsSet = await (0, concurrency_limit_1.getConcurrencyLimitedJobs)(req.auth.team_id);
    const validJobStatuses = [];
    const validJobIDs = [];
    for (const [id, status] of jobStatuses) {
        if (throttledJobsSet.has(id)) {
            validJobStatuses.push([id, "prioritized"]);
            validJobIDs.push(id);
        }
        else if (status !== "failed" &&
            status !== "unknown") {
            validJobStatuses.push([id, status]);
            validJobIDs.push(id);
        }
    }
    const status = sc.cancelled
        ? "cancelled"
        : validJobStatuses.every((x) => x[1] === "completed")
            ? "completed"
            : "scraping";
    jobIDs = validJobIDs; // Use validJobIDs instead of jobIDs for further processing
    const doneJobs = await (0, crawl_status_1.getJobs)(doneJobIDs);
    const data = doneJobs.map((x) => x.returnvalue);
    await send(ws, {
        type: "catchup",
        data: {
            success: true,
            status,
            total: jobIDs.length,
            completed: doneJobIDs.length,
            creditsUsed: jobIDs.length,
            expiresAt: (await (0, crawl_redis_1.getCrawlExpiry)(req.params.jobId)).toISOString(),
            data: data,
        },
    });
    if (status !== "scraping") {
        finished = true;
        return close(ws, 1000, { type: "done" });
    }
}
// Basically just middleware and error wrapping
async function crawlStatusWSController(ws, req) {
    try {
        const auth = await (0, auth_1.authenticateUser)(req, null, types_1.RateLimiterMode.CrawlStatus);
        if (!auth.success) {
            return close(ws, 3000, {
                type: "error",
                error: auth.error,
            });
        }
        const { team_id } = auth;
        req.auth = { team_id };
        await crawlStatusWS(ws, req);
    }
    catch (err) {
        Sentry.captureException(err);
        const id = (0, uuid_1.v4)();
        let verbose = JSON.stringify(err);
        if (verbose === "{}") {
            if (err instanceof Error) {
                verbose = JSON.stringify({
                    message: err.message,
                    name: err.name,
                    stack: err.stack,
                });
            }
        }
        logger_1.logger.error("Error occurred in WebSocket! (" +
            req.path +
            ") -- ID " +
            id +
            " -- " +
            verbose);
        return close(ws, 1011, {
            type: "error",
            error: "An unexpected error occurred. Please contact help@firecrawl.com for help. Your exception ID is " +
                id,
        });
    }
}
//# sourceMappingURL=crawl-status-ws.js.map