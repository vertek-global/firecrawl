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
exports._addScrapeJobToBullMQ = _addScrapeJobToBullMQ;
exports.addScrapeJob = addScrapeJob;
exports.addScrapeJobs = addScrapeJobs;
exports.waitForJob = waitForJob;
const queue_service_1 = require("./queue-service");
const uuid_1 = require("uuid");
const types_1 = require("../types");
const Sentry = __importStar(require("@sentry/node"));
const concurrency_limit_1 = require("../lib/concurrency-limit");
const logger_1 = require("../lib/logger");
const email_notification_1 = require("./notification/email_notification");
const notification_check_1 = require("./notification/notification-check");
const auth_1 = require("../controllers/auth");
const gcs_jobs_1 = require("../lib/gcs-jobs");
const crawl_redis_1 = require("../lib/crawl-redis");
/**
 * Checks if a job is a crawl or batch scrape based on its options
 * @param options The job options containing crawlerOptions and crawl_id
 * @returns true if the job is either a crawl or batch scrape
 */
function isCrawlOrBatchScrape(options) {
    // If crawlerOptions exists, it's a crawl
    // If crawl_id exists but no crawlerOptions, it's a batch scrape
    return !!options.crawlerOptions || !!options.crawl_id;
}
async function _addScrapeJobToConcurrencyQueue(webScraperOptions, options, jobId, jobPriority) {
    await (0, concurrency_limit_1.pushConcurrencyLimitedJob)(webScraperOptions.team_id, {
        id: jobId,
        data: webScraperOptions,
        opts: {
            ...options,
            priority: jobPriority,
            jobId: jobId,
        },
        priority: jobPriority,
    }, webScraperOptions.crawl_id ? Infinity : (webScraperOptions.scrapeOptions?.timeout ?? (60 * 1000)));
}
async function _addScrapeJobToBullMQ(webScraperOptions, options, jobId, jobPriority) {
    if (webScraperOptions &&
        webScraperOptions.team_id) {
        await (0, concurrency_limit_1.pushConcurrencyLimitActiveJob)(webScraperOptions.team_id, jobId, 60 * 1000); // 60s default timeout
        if (webScraperOptions.crawl_id) {
            const sc = await (0, crawl_redis_1.getCrawl)(webScraperOptions.crawl_id);
            if (webScraperOptions.crawlerOptions?.delay || sc?.maxConcurrency) {
                await (0, concurrency_limit_1.pushCrawlConcurrencyLimitActiveJob)(webScraperOptions.crawl_id, jobId, 60 * 1000);
            }
        }
    }
    await (0, queue_service_1.getScrapeQueue)().add(jobId, webScraperOptions, {
        ...options,
        priority: jobPriority,
        jobId,
    });
}
async function addScrapeJobRaw(webScraperOptions, options, jobId, jobPriority, directToBullMQ = false) {
    let concurrencyLimited = null;
    let currentActiveConcurrency = 0;
    let maxConcurrency = 0;
    if (directToBullMQ) {
        concurrencyLimited = "no";
    }
    else {
        if (webScraperOptions.crawl_id) {
            const crawl = await (0, crawl_redis_1.getCrawl)(webScraperOptions.crawl_id);
            const concurrencyLimit = !crawl
                ? null
                : crawl.crawlerOptions?.delay === undefined && crawl.maxConcurrency === undefined
                    ? null
                    : crawl.maxConcurrency ?? 1;
            if (concurrencyLimit !== null) {
                const crawlConcurrency = (await (0, concurrency_limit_1.getCrawlConcurrencyLimitActiveJobs)(webScraperOptions.crawl_id)).length;
                const freeSlots = Math.max(concurrencyLimit - crawlConcurrency, 0);
                if (freeSlots === 0) {
                    concurrencyLimited = "yes-crawl";
                }
            }
        }
        if (concurrencyLimited === null) {
            const now = Date.now();
            const maxConcurrency = (await (0, auth_1.getACUCTeam)(webScraperOptions.team_id, false, true, webScraperOptions.is_extract ? types_1.RateLimiterMode.Extract : types_1.RateLimiterMode.Crawl))?.concurrency ?? 2;
            await (0, concurrency_limit_1.cleanOldConcurrencyLimitEntries)(webScraperOptions.team_id, now);
            const currentActiveConcurrency = (await (0, concurrency_limit_1.getConcurrencyLimitActiveJobs)(webScraperOptions.team_id, now)).length;
            concurrencyLimited = currentActiveConcurrency >= maxConcurrency ? "yes" : "no";
        }
    }
    if (concurrencyLimited === "yes" || concurrencyLimited === "yes-crawl") {
        if (concurrencyLimited === "yes") {
            // Detect if they hit their concurrent limit
            // If above by 2x, send them an email
            // No need to 2x as if there are more than the max concurrency in the concurrency queue, it is already 2x
            const concurrencyQueueJobs = await (0, concurrency_limit_1.getConcurrencyQueueJobsCount)(webScraperOptions.team_id);
            if (concurrencyQueueJobs > maxConcurrency) {
                // logger.info("Concurrency limited 2x (single) - ", "Concurrency queue jobs: ", concurrencyQueueJobs, "Max concurrency: ", maxConcurrency, "Team ID: ", webScraperOptions.team_id);
                // Only send notification if it's not a crawl or batch scrape
                const shouldSendNotification = await (0, notification_check_1.shouldSendConcurrencyLimitNotification)(webScraperOptions.team_id);
                if (shouldSendNotification) {
                    (0, email_notification_1.sendNotificationWithCustomDays)(webScraperOptions.team_id, types_1.NotificationType.CONCURRENCY_LIMIT_REACHED, 15, false, true).catch((error) => {
                        logger_1.logger.error("Error sending notification (concurrency limit reached)", { error });
                    });
                }
            }
        }
        webScraperOptions.concurrencyLimited = true;
        await _addScrapeJobToConcurrencyQueue(webScraperOptions, options, jobId, jobPriority);
    }
    else {
        await _addScrapeJobToBullMQ(webScraperOptions, options, jobId, jobPriority);
    }
}
async function addScrapeJob(webScraperOptions, options = {}, jobId = (0, uuid_1.v4)(), jobPriority = 10, directToBullMQ = false) {
    if (Sentry.isInitialized()) {
        const size = JSON.stringify(webScraperOptions).length;
        return await Sentry.startSpan({
            name: "Add scrape job",
            op: "queue.publish",
            attributes: {
                "messaging.message.id": jobId,
                "messaging.destination.name": (0, queue_service_1.getScrapeQueue)().name,
                "messaging.message.body.size": size,
            },
        }, async (span) => {
            await addScrapeJobRaw({
                ...webScraperOptions,
                sentry: {
                    trace: Sentry.spanToTraceHeader(span),
                    baggage: Sentry.spanToBaggageHeader(span),
                    size,
                },
            }, options, jobId, jobPriority, directToBullMQ);
        });
    }
    else {
        await addScrapeJobRaw(webScraperOptions, options, jobId, jobPriority, directToBullMQ);
    }
}
async function addScrapeJobs(jobs) {
    if (jobs.length === 0)
        return true;
    const jobsByTeam = new Map();
    for (const job of jobs) {
        if (!jobsByTeam.has(job.data.team_id)) {
            jobsByTeam.set(job.data.team_id, []);
        }
        jobsByTeam.get(job.data.team_id).push(job);
    }
    for (const [teamId, teamJobs] of jobsByTeam) {
        // == Buckets for jobs ==
        let jobsForcedToCQ = [];
        let jobsPotentiallyInCQ = [];
        // == Select jobs by crawl ID ==
        const jobsByCrawlID = new Map();
        const jobsWithoutCrawlID = [];
        for (const job of teamJobs) {
            if (job.data.crawl_id) {
                if (!jobsByCrawlID.has(job.data.crawl_id)) {
                    jobsByCrawlID.set(job.data.crawl_id, []);
                }
                jobsByCrawlID.get(job.data.crawl_id).push(job);
            }
            else {
                jobsWithoutCrawlID.push(job);
            }
        }
        // == Select jobs by crawl ID ==
        for (const [crawlID, crawlJobs] of jobsByCrawlID) {
            const crawl = await (0, crawl_redis_1.getCrawl)(crawlID);
            const concurrencyLimit = !crawl
                ? null
                : crawl.crawlerOptions?.delay === undefined && crawl.maxConcurrency === undefined
                    ? null
                    : crawl.maxConcurrency ?? 1;
            if (concurrencyLimit === null) {
                // All jobs may be in the CQ depending on the global team concurrency limit
                jobsPotentiallyInCQ.push(...crawlJobs);
            }
            else {
                const crawlConcurrency = (await (0, concurrency_limit_1.getCrawlConcurrencyLimitActiveJobs)(crawlID)).length;
                const freeSlots = Math.max(concurrencyLimit - crawlConcurrency, 0);
                // The first n jobs may be in the CQ depending on the global team concurrency limit
                jobsPotentiallyInCQ.push(...crawlJobs.slice(0, freeSlots));
                // Every job after that must be in the CQ, as the crawl concurrency limit has been reached
                jobsForcedToCQ.push(...crawlJobs.slice(freeSlots));
            }
        }
        // All jobs without a crawl ID may be in the CQ depending on the global team concurrency limit
        jobsPotentiallyInCQ.push(...jobsWithoutCrawlID);
        const now = Date.now();
        const maxConcurrency = (await (0, auth_1.getACUCTeam)(teamId, false, true, jobs[0].data.from_extract ? types_1.RateLimiterMode.Extract : types_1.RateLimiterMode.Crawl))?.concurrency ?? 2;
        await (0, concurrency_limit_1.cleanOldConcurrencyLimitEntries)(teamId, now);
        const currentActiveConcurrency = (await (0, concurrency_limit_1.getConcurrencyLimitActiveJobs)(teamId, now)).length;
        const countCanBeDirectlyAdded = Math.max(maxConcurrency - currentActiveConcurrency, 0);
        const addToBull = jobsPotentiallyInCQ.slice(0, countCanBeDirectlyAdded);
        const addToCQ = jobsPotentiallyInCQ.slice(countCanBeDirectlyAdded).concat(jobsForcedToCQ);
        // equals 2x the max concurrency
        if ((jobsPotentiallyInCQ.length - countCanBeDirectlyAdded) > maxConcurrency) {
            // logger.info(`Concurrency limited 2x (multiple) - Concurrency queue jobs: ${addToCQ.length} Max concurrency: ${maxConcurrency} Team ID: ${jobs[0].data.team_id}`);
            // Only send notification if it's not a crawl or batch scrape
            if (!isCrawlOrBatchScrape(jobs[0].data)) {
                const shouldSendNotification = await (0, notification_check_1.shouldSendConcurrencyLimitNotification)(jobs[0].data.team_id);
                if (shouldSendNotification) {
                    (0, email_notification_1.sendNotificationWithCustomDays)(jobs[0].data.team_id, types_1.NotificationType.CONCURRENCY_LIMIT_REACHED, 15, false, true).catch((error) => {
                        logger_1.logger.error("Error sending notification (concurrency limit reached)", { error });
                    });
                }
            }
        }
        await Promise.all(addToCQ.map(async (job) => {
            const size = JSON.stringify(job.data).length;
            return await Sentry.startSpan({
                name: "Add scrape job",
                op: "queue.publish",
                attributes: {
                    "messaging.message.id": job.opts.jobId,
                    "messaging.destination.name": (0, queue_service_1.getScrapeQueue)().name,
                    "messaging.message.body.size": size,
                },
            }, async (span) => {
                const jobData = {
                    ...job.data,
                    sentry: {
                        trace: Sentry.spanToTraceHeader(span),
                        baggage: Sentry.spanToBaggageHeader(span),
                        size,
                    },
                };
                await _addScrapeJobToConcurrencyQueue(jobData, job.opts, job.opts.jobId, job.opts.priority);
            });
        }));
        await Promise.all(addToBull.map(async (job) => {
            const size = JSON.stringify(job.data).length;
            return await Sentry.startSpan({
                name: "Add scrape job",
                op: "queue.publish",
                attributes: {
                    "messaging.message.id": job.opts.jobId,
                    "messaging.destination.name": (0, queue_service_1.getScrapeQueue)().name,
                    "messaging.message.body.size": size,
                },
            }, async (span) => {
                await _addScrapeJobToBullMQ({
                    ...job.data,
                    sentry: {
                        trace: Sentry.spanToTraceHeader(span),
                        baggage: Sentry.spanToBaggageHeader(span),
                        size,
                    },
                }, job.opts, job.opts.jobId, job.opts.priority);
            });
        }));
    }
}
function waitForJob(jobId, timeout) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const int = setInterval(async () => {
            if (Date.now() >= start + timeout) {
                clearInterval(int);
                reject(new Error("Job wait "));
            }
            else {
                const state = await (0, queue_service_1.getScrapeQueue)().getJobState(jobId);
                if (state === "completed") {
                    clearInterval(int);
                    let doc;
                    const job = (await (0, queue_service_1.getScrapeQueue)().getJob(jobId));
                    doc = job.returnvalue;
                    if (!doc) {
                        const docs = await (0, gcs_jobs_1.getJobFromGCS)(jobId);
                        if (!docs || docs.length === 0) {
                            throw new Error("Job not found in GCS");
                        }
                        doc = docs[0];
                        if (job.data?.internalOptions?.zeroDataRetention) {
                            await (0, gcs_jobs_1.removeJobFromGCS)(jobId);
                        }
                    }
                    resolve(doc);
                }
                else if (state === "failed") {
                    const job = await (0, queue_service_1.getScrapeQueue)().getJob(jobId);
                    if (job && job.failedReason !== "Concurrency limit hit") {
                        clearInterval(int);
                        reject(job.failedReason);
                    }
                }
            }
        }, 250);
    });
}
//# sourceMappingURL=queue-jobs.js.map