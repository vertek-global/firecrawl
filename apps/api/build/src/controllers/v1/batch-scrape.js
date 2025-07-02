"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchScrapeController = batchScrapeController;
const uuid_1 = require("uuid");
const types_1 = require("./types");
const crawl_redis_1 = require("../../lib/crawl-redis");
const crawl_log_1 = require("../../services/logging/crawl_log");
const job_priority_1 = require("../../lib/job-priority");
const queue_jobs_1 = require("../../services/queue-jobs");
const webhook_1 = require("../../services/webhook");
const logger_1 = require("../../lib/logger");
const strings_1 = require("../../lib/strings");
const blocklist_1 = require("../../scraper/WebScraper/utils/blocklist");
async function batchScrapeController(req, res) {
    const preNormalizedBody = { ...req.body };
    if (req.body.zeroDataRetention && !req.acuc?.flags?.allowZDR) {
        return res.status(400).json({
            success: false,
            error: "Zero data retention is enabled for this team. If you're interested in ZDR, please contact support@firecrawl.com",
        });
    }
    const zeroDataRetention = req.acuc?.flags?.forceZDR || req.body.zeroDataRetention;
    if (req.body?.ignoreInvalidURLs === true) {
        req.body = types_1.batchScrapeRequestSchemaNoURLValidation.parse(req.body);
    }
    else {
        req.body = types_1.batchScrapeRequestSchema.parse(req.body);
    }
    const id = req.body.appendToId ?? (0, uuid_1.v4)();
    const logger = logger_1.logger.child({
        crawlId: id,
        batchScrapeId: id,
        module: "api/v1",
        method: "batchScrapeController",
        teamId: req.auth.team_id,
        zeroDataRetention,
    });
    let urls = req.body.urls;
    let unnormalizedURLs = preNormalizedBody.urls;
    let invalidURLs = undefined;
    if (req.body.ignoreInvalidURLs) {
        invalidURLs = [];
        let pendingURLs = urls;
        urls = [];
        unnormalizedURLs = [];
        for (const u of pendingURLs) {
            try {
                const nu = types_1.url.parse(u);
                if (!(0, blocklist_1.isUrlBlocked)(nu, req.acuc?.flags ?? null)) {
                    urls.push(nu);
                    unnormalizedURLs.push(u);
                }
                else {
                    invalidURLs.push(u);
                }
            }
            catch (_) {
                invalidURLs.push(u);
            }
        }
    }
    else {
        if (req.body.urls?.some((url) => (0, blocklist_1.isUrlBlocked)(url, req.acuc?.flags ?? null))) {
            if (!res.headersSent) {
                return res.status(403).json({
                    success: false,
                    error: strings_1.BLOCKLISTED_URL_MESSAGE,
                });
            }
        }
    }
    logger.debug("Batch scrape " + id + " starting", {
        urlsLength: urls.length,
        appendToId: req.body.appendToId,
        account: req.account,
    });
    if (!req.body.appendToId) {
        await (0, crawl_log_1.logCrawl)(id, req.auth.team_id);
    }
    const sc = req.body.appendToId
        ? (await (0, crawl_redis_1.getCrawl)(req.body.appendToId))
        : {
            crawlerOptions: null,
            scrapeOptions: req.body,
            internalOptions: {
                disableSmartWaitCache: true,
                teamId: req.auth.team_id,
                saveScrapeResultToGCS: process.env.GCS_FIRE_ENGINE_BUCKET_NAME ? true : false,
                zeroDataRetention,
            }, // NOTE: smart wait disabled for batch scrapes to ensure contentful scrape, speed does not matter
            team_id: req.auth.team_id,
            createdAt: Date.now(),
            maxConcurrency: req.body.maxConcurrency,
            zeroDataRetention,
        };
    if (!req.body.appendToId) {
        await (0, crawl_redis_1.saveCrawl)(id, sc);
    }
    let jobPriority = 20;
    // If it is over 1000, we need to get the job priority,
    // otherwise we can use the default priority of 20
    if (urls.length > 1000) {
        // set base to 21
        jobPriority = await (0, job_priority_1.getJobPriority)({
            team_id: req.auth.team_id,
            basePriority: 21,
        });
    }
    logger.debug("Using job priority " + jobPriority, { jobPriority });
    const scrapeOptions = { ...req.body };
    delete scrapeOptions.urls;
    delete scrapeOptions.appendToId;
    const jobs = urls.map(x => ({
        data: {
            url: x,
            mode: "single_urls",
            team_id: req.auth.team_id,
            crawlerOptions: null,
            scrapeOptions,
            origin: "api",
            integration: req.body.integration,
            crawl_id: id,
            sitemapped: true,
            v1: true,
            webhook: req.body.webhook,
            internalOptions: sc.internalOptions,
            zeroDataRetention,
        },
        opts: {
            jobId: (0, uuid_1.v4)(),
            priority: 20,
        },
    }));
    await (0, crawl_redis_1.finishCrawlKickoff)(id);
    logger.debug("Locking URLs...");
    await (0, crawl_redis_1.lockURLs)(id, sc, jobs.map((x) => x.data.url), logger);
    logger.debug("Adding scrape jobs to Redis...");
    await (0, crawl_redis_1.addCrawlJobs)(id, jobs.map((x) => x.opts.jobId), logger);
    logger.debug("Adding scrape jobs to BullMQ...");
    await (0, queue_jobs_1.addScrapeJobs)(jobs);
    if (req.body.webhook) {
        logger.debug("Calling webhook with batch_scrape.started...", {
            webhook: req.body.webhook,
        });
        await (0, webhook_1.callWebhook)({
            teamId: req.auth.team_id,
            crawlId: id,
            data: null,
            webhook: req.body.webhook,
            v1: true,
            eventType: "batch_scrape.started",
        });
    }
    const protocol = process.env.ENV === "local" ? req.protocol : "https";
    return res.status(200).json({
        success: true,
        id,
        url: `${protocol}://${req.get("host")}/v1/batch/scrape/${id}`,
        invalidURLs,
    });
}
//# sourceMappingURL=batch-scrape.js.map