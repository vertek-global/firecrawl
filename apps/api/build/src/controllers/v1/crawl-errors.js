"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJob = getJob;
exports.getJobs = getJobs;
exports.crawlErrorsController = crawlErrorsController;
const crawl_redis_1 = require("../../lib/crawl-redis");
const queue_service_1 = require("../../services/queue-service");
const redis_1 = require("../../../src/services/redis");
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
async function getJob(id) {
    const job = await (0, queue_service_1.getScrapeQueue)().getJob(id);
    if (!job)
        return job;
    return job;
}
async function getJobs(ids) {
    const jobs = (await Promise.all(ids.map((x) => (0, queue_service_1.getScrapeQueue)().getJob(x)))).filter((x) => x);
    return jobs;
}
async function crawlErrorsController(req, res) {
    const sc = await (0, crawl_redis_1.getCrawl)(req.params.jobId);
    if (!sc) {
        return res.status(404).json({ success: false, error: "Job not found" });
    }
    if (sc.team_id !== req.auth.team_id) {
        return res.status(403).json({ success: false, error: "Forbidden" });
    }
    let jobStatuses = await Promise.all((await (0, crawl_redis_1.getCrawlJobs)(req.params.jobId)).map(async (x) => [x, await (0, queue_service_1.getScrapeQueue)().getJobState(x)]));
    const failedJobIDs = [];
    for (const [id, status] of jobStatuses) {
        if (status === "failed") {
            failedJobIDs.push(id);
        }
    }
    res.status(200).json({
        errors: (await getJobs(failedJobIDs)).map((x) => ({
            id: x.id,
            timestamp: x.finishedOn !== undefined
                ? new Date(x.finishedOn).toISOString()
                : undefined,
            url: x.data.url,
            error: x.failedReason,
        })),
        robotsBlocked: await redis_1.redisEvictConnection.smembers("crawl:" + req.params.jobId + ":robots_blocked"),
    });
}
//# sourceMappingURL=crawl-errors.js.map