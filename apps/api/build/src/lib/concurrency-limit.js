"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanOldConcurrencyLimitEntries = cleanOldConcurrencyLimitEntries;
exports.getConcurrencyLimitActiveJobs = getConcurrencyLimitActiveJobs;
exports.pushConcurrencyLimitActiveJob = pushConcurrencyLimitActiveJob;
exports.removeConcurrencyLimitActiveJob = removeConcurrencyLimitActiveJob;
exports.takeConcurrencyLimitedJob = takeConcurrencyLimitedJob;
exports.pushConcurrencyLimitedJob = pushConcurrencyLimitedJob;
exports.getConcurrencyLimitedJobs = getConcurrencyLimitedJobs;
exports.getConcurrencyQueueJobsCount = getConcurrencyQueueJobsCount;
exports.cleanOldCrawlConcurrencyLimitEntries = cleanOldCrawlConcurrencyLimitEntries;
exports.getCrawlConcurrencyLimitActiveJobs = getCrawlConcurrencyLimitActiveJobs;
exports.pushCrawlConcurrencyLimitActiveJob = pushCrawlConcurrencyLimitActiveJob;
exports.removeCrawlConcurrencyLimitActiveJob = removeCrawlConcurrencyLimitActiveJob;
exports.concurrentJobDone = concurrentJobDone;
const types_1 = require("../types");
const redis_1 = require("../services/redis");
const auth_1 = require("../controllers/auth");
const crawl_redis_1 = require("./crawl-redis");
const queue_service_1 = require("../services/queue-service");
const logger_1 = require("./logger");
const constructKey = (team_id) => "concurrency-limiter:" + team_id;
const constructQueueKey = (team_id) => "concurrency-limit-queue:" + team_id;
const constructCrawlKey = (crawl_id) => "crawl-concurrency-limiter:" + crawl_id;
async function cleanOldConcurrencyLimitEntries(team_id, now = Date.now()) {
    await redis_1.redisEvictConnection.zremrangebyscore(constructKey(team_id), -Infinity, now);
}
async function getConcurrencyLimitActiveJobs(team_id, now = Date.now()) {
    return await redis_1.redisEvictConnection.zrangebyscore(constructKey(team_id), now, Infinity);
}
async function pushConcurrencyLimitActiveJob(team_id, id, timeout, now = Date.now()) {
    await redis_1.redisEvictConnection.zadd(constructKey(team_id), now + timeout, id);
}
async function removeConcurrencyLimitActiveJob(team_id, id) {
    await redis_1.redisEvictConnection.zrem(constructKey(team_id), id);
}
async function takeConcurrencyLimitedJob(team_id) {
    await redis_1.redisEvictConnection.zremrangebyscore(constructQueueKey(team_id), -Infinity, Date.now());
    const res = await redis_1.redisEvictConnection.zmpop(1, constructQueueKey(team_id), "MIN");
    if (res === null || res === undefined) {
        return null;
    }
    return JSON.parse(res[1][0][0]);
}
async function pushConcurrencyLimitedJob(team_id, job, timeout, now = Date.now()) {
    await redis_1.redisEvictConnection.zadd(constructQueueKey(team_id), now + timeout, JSON.stringify(job));
}
async function getConcurrencyLimitedJobs(team_id) {
    return new Set((await redis_1.redisEvictConnection.zrange(constructQueueKey(team_id), 0, -1)).map(x => JSON.parse(x).id));
}
async function getConcurrencyQueueJobsCount(team_id) {
    const count = await redis_1.redisEvictConnection.zcard(constructQueueKey(team_id));
    return count;
}
async function cleanOldCrawlConcurrencyLimitEntries(crawl_id, now = Date.now()) {
    await redis_1.redisEvictConnection.zremrangebyscore(constructCrawlKey(crawl_id), -Infinity, now);
}
async function getCrawlConcurrencyLimitActiveJobs(crawl_id, now = Date.now()) {
    return await redis_1.redisEvictConnection.zrangebyscore(constructCrawlKey(crawl_id), now, Infinity);
}
async function pushCrawlConcurrencyLimitActiveJob(crawl_id, id, timeout, now = Date.now()) {
    await redis_1.redisEvictConnection.zadd(constructCrawlKey(crawl_id), now + timeout, id);
}
async function removeCrawlConcurrencyLimitActiveJob(crawl_id, id) {
    await redis_1.redisEvictConnection.zrem(constructCrawlKey(crawl_id), id);
}
/**
 * Grabs the next job from the team's concurrency limit queue. Handles crawl concurrency limits.
 *
 * This function may only be called once the outer code has verified that the team has not reached its concurrency limit.
 *
 * @param teamId
 * @returns A job that can be run, or null if there are no more jobs to run.
 */
async function getNextConcurrentJob(teamId, i = 0) {
    let finalJob = null;
    const crawlCache = new Map();
    let cursor = "0";
    while (true) {
        const scanResult = await redis_1.redisEvictConnection.zscan(constructQueueKey(teamId), cursor, "COUNT", 1);
        cursor = scanResult[0];
        const results = scanResult[1];
        for (let i = 0; i < results.length; i += 2) {
            const res = {
                job: JSON.parse(results[i]),
                _member: results[i],
                timeout: results[i + 1] === "inf" ? Infinity : parseFloat(results[i + 1]),
            };
            // If the job is associated with a crawl ID, we need to check if the crawl has a max concurrency limit
            if (res.job.data.crawl_id) {
                const sc = crawlCache.get(res.job.data.crawl_id) ?? await (0, crawl_redis_1.getCrawl)(res.job.data.crawl_id);
                if (sc !== null) {
                    crawlCache.set(res.job.data.crawl_id, sc);
                }
                const maxCrawlConcurrency = sc === null
                    ? null
                    : (typeof sc.crawlerOptions?.delay === "number")
                        ? 1
                        : sc.maxConcurrency ?? null;
                if (maxCrawlConcurrency !== null) {
                    // If the crawl has a max concurrency limit, we need to check if the crawl has reached the limit
                    const currentActiveConcurrency = (await getCrawlConcurrencyLimitActiveJobs(res.job.data.crawl_id)).length;
                    if (currentActiveConcurrency < maxCrawlConcurrency) {
                        // If we're under the max concurrency limit, we can run the job
                        finalJob = res;
                    }
                }
                else {
                    // If the crawl has no max concurrency limit, we can run the job
                    finalJob = res;
                }
            }
            else {
                // If the job is not associated with a crawl ID, we can run the job
                finalJob = res;
            }
            if (finalJob !== null) {
                break;
            }
        }
        if (finalJob !== null) {
            break;
        }
        if (cursor === "0") {
            break;
        }
    }
    if (finalJob !== null) {
        const res = await redis_1.redisEvictConnection.zrem(constructQueueKey(teamId), finalJob._member);
        if (res === 0) {
            // It's normal for this to happen, but if it happens too many times, we should log a warning
            if (i > 15) {
                logger_1.logger.warn("Failed to remove job from concurrency limit queue", {
                    teamId,
                    jobId: finalJob.job.id,
                    zeroDataRetention: finalJob.job.data?.zeroDataRetention,
                    i
                });
            }
            return await getNextConcurrentJob(teamId, i + 1);
        }
    }
    return finalJob;
}
/**
 * Called when a job associated with a concurrency queue is done.
 *
 * @param job The BullMQ job that is done.
 */
async function concurrentJobDone(job) {
    if (job.id && job.data && job.data.team_id) {
        await removeConcurrencyLimitActiveJob(job.data.team_id, job.id);
        await cleanOldConcurrencyLimitEntries(job.data.team_id);
        if (job.data.crawl_id) {
            await removeCrawlConcurrencyLimitActiveJob(job.data.crawl_id, job.id);
            await cleanOldCrawlConcurrencyLimitEntries(job.data.crawl_id);
        }
        const maxTeamConcurrency = (await (0, auth_1.getACUCTeam)(job.data.team_id, false, true, job.data.is_extract ? types_1.RateLimiterMode.Extract : types_1.RateLimiterMode.Crawl))?.concurrency ?? 2;
        const currentActiveConcurrency = (await getConcurrencyLimitActiveJobs(job.data.team_id)).length;
        if (currentActiveConcurrency < maxTeamConcurrency) {
            const nextJob = await getNextConcurrentJob(job.data.team_id);
            if (nextJob !== null) {
                await pushConcurrencyLimitActiveJob(job.data.team_id, nextJob.job.id, 60 * 1000);
                if (nextJob.job.data.crawl_id) {
                    await pushCrawlConcurrencyLimitActiveJob(nextJob.job.data.crawl_id, nextJob.job.id, 60 * 1000);
                    const sc = await (0, crawl_redis_1.getCrawl)(nextJob.job.data.crawl_id);
                    if (sc !== null && typeof sc.crawlerOptions?.delay === "number") {
                        await new Promise(resolve => setTimeout(resolve, sc.crawlerOptions.delay * 1000));
                    }
                }
                (await (0, queue_service_1.getScrapeQueue)()).add(nextJob.job.id, {
                    ...nextJob.job.data,
                    concurrencyLimitHit: true,
                }, {
                    ...nextJob.job.opts,
                    jobId: nextJob.job.id,
                    priority: nextJob.job.priority,
                });
            }
        }
    }
}
//# sourceMappingURL=concurrency-limit.js.map