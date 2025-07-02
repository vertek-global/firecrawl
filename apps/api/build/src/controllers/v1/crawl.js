"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlController = crawlController;
const uuid_1 = require("uuid");
const types_1 = require("./types");
const crawl_redis_1 = require("../../lib/crawl-redis");
const crawl_log_1 = require("../../services/logging/crawl_log");
const queue_jobs_1 = require("../../services/queue-jobs");
const logger_1 = require("../../lib/logger");
async function crawlController(req, res) {
    const preNormalizedBody = req.body;
    req.body = types_1.crawlRequestSchema.parse(req.body);
    if (req.body.zeroDataRetention && !req.acuc?.flags?.allowZDR) {
        return res.status(400).json({
            success: false,
            error: "Zero data retention is enabled for this team. If you're interested in ZDR, please contact support@firecrawl.com",
        });
    }
    const zeroDataRetention = req.acuc?.flags?.forceZDR || req.body.zeroDataRetention;
    const id = (0, uuid_1.v4)();
    const logger = logger_1.logger.child({
        crawlId: id,
        module: "api/v1",
        method: "crawlController",
        teamId: req.auth.team_id,
        zeroDataRetention,
    });
    logger.debug("Crawl " + id + " starting", {
        request: req.body,
        originalRequest: preNormalizedBody,
        account: req.account,
    });
    await (0, crawl_log_1.logCrawl)(id, req.auth.team_id);
    let { remainingCredits } = req.account;
    const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === "true";
    if (!useDbAuthentication) {
        remainingCredits = Infinity;
    }
    const crawlerOptions = {
        ...req.body,
        url: undefined,
        scrapeOptions: undefined,
    };
    const scrapeOptions = req.body.scrapeOptions;
    // TODO: @rafa, is this right? copied from v0
    if (Array.isArray(crawlerOptions.includePaths)) {
        for (const x of crawlerOptions.includePaths) {
            try {
                new RegExp(x);
            }
            catch (e) {
                return res.status(400).json({ success: false, error: e.message });
            }
        }
    }
    if (Array.isArray(crawlerOptions.excludePaths)) {
        for (const x of crawlerOptions.excludePaths) {
            try {
                new RegExp(x);
            }
            catch (e) {
                return res.status(400).json({ success: false, error: e.message });
            }
        }
    }
    const originalLimit = crawlerOptions.limit;
    crawlerOptions.limit = Math.min(remainingCredits, crawlerOptions.limit);
    logger.debug("Determined limit: " + crawlerOptions.limit, {
        remainingCredits,
        bodyLimit: originalLimit,
        originalBodyLimit: preNormalizedBody.limit,
    });
    const sc = {
        originUrl: req.body.url,
        crawlerOptions: (0, types_1.toLegacyCrawlerOptions)(crawlerOptions),
        scrapeOptions,
        internalOptions: {
            disableSmartWaitCache: true,
            teamId: req.auth.team_id,
            saveScrapeResultToGCS: process.env.GCS_FIRE_ENGINE_BUCKET_NAME ? true : false,
            zeroDataRetention,
        }, // NOTE: smart wait disabled for crawls to ensure contentful scrape, speed does not matter
        team_id: req.auth.team_id,
        createdAt: Date.now(),
        maxConcurrency: req.body.maxConcurrency !== undefined ? Math.min(req.body.maxConcurrency, req.acuc.concurrency) : undefined,
        zeroDataRetention,
    };
    const crawler = (0, crawl_redis_1.crawlToCrawler)(id, sc, req.acuc?.flags ?? null);
    try {
        sc.robots = await crawler.getRobotsTxt(scrapeOptions.skipTlsVerification);
        const robotsCrawlDelay = crawler.getRobotsCrawlDelay();
        if (robotsCrawlDelay !== null && !sc.crawlerOptions.delay) {
            sc.crawlerOptions.delay = robotsCrawlDelay;
        }
    }
    catch (e) {
        logger.debug("Failed to get robots.txt (this is probably fine!)", {
            error: e,
        });
    }
    await (0, crawl_redis_1.saveCrawl)(id, sc);
    await (0, queue_jobs_1._addScrapeJobToBullMQ)({
        url: req.body.url,
        mode: "kickoff",
        team_id: req.auth.team_id,
        crawlerOptions,
        scrapeOptions: sc.scrapeOptions,
        internalOptions: sc.internalOptions,
        origin: req.body.origin,
        integration: req.body.integration,
        crawl_id: id,
        webhook: req.body.webhook,
        v1: true,
        zeroDataRetention: zeroDataRetention || false,
    }, {}, crypto.randomUUID(), 10);
    const protocol = process.env.ENV === "local" ? req.protocol : "https";
    return res.status(200).json({
        success: true,
        id,
        url: `${protocol}://${req.get("host")}/v1/crawl/${id}`,
    });
}
//# sourceMappingURL=crawl.js.map