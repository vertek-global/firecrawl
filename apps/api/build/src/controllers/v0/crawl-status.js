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
exports.getJobs = getJobs;
exports.crawlStatusController = crawlStatusController;
const auth_1 = require("../auth");
const types_1 = require("../../../src/types");
const queue_service_1 = require("../../../src/services/queue-service");
const redis_1 = require("../../../src/services/redis");
const logger_1 = require("../../../src/lib/logger");
const crawl_redis_1 = require("../../../src/lib/crawl-redis");
const supabase_jobs_1 = require("../../../src/lib/supabase-jobs");
const Sentry = __importStar(require("@sentry/node"));
const dotenv_1 = require("dotenv");
const types_2 = require("../v1/types");
const gcs_jobs_1 = require("../../lib/gcs-jobs");
(0, dotenv_1.configDotenv)();
async function getJobs(crawlId, ids) {
    const [bullJobs, dbJobs, gcsJobs] = await Promise.all([
        Promise.all(ids.map((x) => (0, queue_service_1.getScrapeQueue)().getJob(x))).then(x => x.filter(x => x)),
        process.env.USE_DB_AUTHENTICATION === "true" ? await (0, supabase_jobs_1.supabaseGetJobsByCrawlId)(crawlId) : [],
        process.env.GCS_BUCKET_NAME ? Promise.all(ids.map(async (x) => ({ id: x, job: await (0, gcs_jobs_1.getJobFromGCS)(x) }))).then(x => x.filter(x => x.job)) : [],
    ]);
    const bullJobMap = new Map();
    const dbJobMap = new Map();
    const gcsJobMap = new Map();
    for (const job of bullJobs) {
        bullJobMap.set(job.id, job);
    }
    for (const job of dbJobs) {
        dbJobMap.set(job.job_id, job);
    }
    for (const job of gcsJobs) {
        gcsJobMap.set(job.id, job.job);
    }
    const jobs = [];
    for (const id of ids) {
        const bullJob = bullJobMap.get(id);
        const dbJob = dbJobMap.get(id);
        const gcsJob = gcsJobMap.get(id);
        if (!bullJob && !dbJob)
            continue;
        const data = gcsJob ?? dbJob?.docs ?? bullJob?.returnvalue;
        if (gcsJob === null && data) {
            logger_1.logger.warn("GCS Job not found", {
                jobId: id,
            });
        }
        const job = {
            id,
            getState: bullJob ? (() => bullJob.getState()) : (() => dbJob.success ? "completed" : "failed"),
            returnvalue: Array.isArray(data)
                ? data[0]
                : data,
            data: {
                scrapeOptions: bullJob ? bullJob.data.scrapeOptions : dbJob.page_options,
            },
            timestamp: bullJob ? bullJob.timestamp : new Date(dbJob.date_added).valueOf(),
            failedReason: (bullJob ? bullJob.failedReason : dbJob.message) || undefined,
        };
        jobs.push(job);
    }
    return jobs;
}
async function crawlStatusController(req, res) {
    try {
        const auth = await (0, auth_1.authenticateUser)(req, res, types_1.RateLimiterMode.CrawlStatus);
        if (!auth.success) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (auth.chunk?.flags?.forceZDR) {
            return res.status(400).json({ error: "Your team has zero data retention enabled. This is not supported on the v0 API. Please update your code to use the v1 API." });
        }
        const { team_id } = auth;
        redis_1.redisEvictConnection.sadd("teams_using_v0", team_id)
            .catch(error => logger_1.logger.error("Failed to add team to teams_using_v0", { error, team_id }));
        const sc = await (0, crawl_redis_1.getCrawl)(req.params.jobId);
        if (!sc) {
            return res.status(404).json({ error: "Job not found" });
        }
        if (sc.team_id !== team_id) {
            return res.status(403).json({ error: "Forbidden" });
        }
        let jobIDs = await (0, crawl_redis_1.getCrawlJobs)(req.params.jobId);
        let jobs = await getJobs(req.params.jobId, jobIDs);
        let jobStatuses = await Promise.all(jobs.map((x) => x.getState()));
        // Combine jobs and jobStatuses into a single array of objects
        let jobsWithStatuses = jobs.map((job, index) => ({
            job,
            status: jobStatuses[index],
        }));
        // Filter out failed jobs
        jobsWithStatuses = jobsWithStatuses.filter((x) => x.status !== "failed" && x.status !== "unknown");
        // Sort jobs by timestamp
        jobsWithStatuses.sort((a, b) => a.job.timestamp - b.job.timestamp);
        // Extract sorted jobs and statuses
        jobs = jobsWithStatuses.map((x) => x.job);
        jobStatuses = jobsWithStatuses.map((x) => x.status);
        const jobStatus = sc.cancelled
            ? "failed"
            : jobStatuses.every((x) => x === "completed")
                ? "completed"
                : "active";
        const data = jobs
            .filter((x) => x.failedReason !== "Concurreny limit hit" && x.returnvalue !== null)
            .map((x) => Array.isArray(x.returnvalue) ? x.returnvalue[0] : x.returnvalue);
        if (jobs.length > 0 &&
            jobs[0].data &&
            jobs[0].data.scrapeOptions &&
            jobs[0].data.scrapeOptions.formats &&
            !jobs[0].data.scrapeOptions.formats.includes("rawHtml")) {
            data.forEach((item) => {
                if (item) {
                    delete item.rawHtml;
                }
            });
        }
        res.json({
            status: jobStatus,
            current: jobStatuses.filter((x) => x === "completed" || x === "failed")
                .length,
            total: jobs.length,
            data: jobStatus === "completed"
                ? data.map((x) => (0, types_2.toLegacyDocument)(x, sc.internalOptions))
                : null,
            partial_data: jobStatus === "completed"
                ? []
                : data
                    .filter((x) => x !== null)
                    .map((x) => (0, types_2.toLegacyDocument)(x, sc.internalOptions)),
        });
    }
    catch (error) {
        Sentry.captureException(error);
        logger_1.logger.error(error);
        return res.status(500).json({ error: error.message });
    }
}
//# sourceMappingURL=crawl-status.js.map