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
exports.crawlController = crawlController;
const credit_billing_1 = require("../../../src/services/billing/credit_billing");
const auth_1 = require("../auth");
const types_1 = require("../../../src/types");
const queue_jobs_1 = require("../../../src/services/queue-jobs");
const blocklist_1 = require("../../../src/scraper/WebScraper/utils/blocklist");
const crawl_log_1 = require("../../../src/services/logging/crawl_log");
const validate_1 = require("../../../src/services/idempotency/validate");
const create_1 = require("../../../src/services/idempotency/create");
const default_values_1 = require("../../../src/lib/default-values");
const uuid_1 = require("uuid");
const logger_1 = require("../../../src/lib/logger");
const crawl_redis_1 = require("../../../src/lib/crawl-redis");
const redis_1 = require("../../../src/services/redis");
const validateUrl_1 = require("../../../src/lib/validateUrl");
const Sentry = __importStar(require("@sentry/node"));
const job_priority_1 = require("../../lib/job-priority");
const types_2 = require("../v1/types");
const zod_1 = require("zod");
const strings_1 = require("../../lib/strings");
async function crawlController(req, res) {
    try {
        const auth = await (0, auth_1.authenticateUser)(req, res, types_1.RateLimiterMode.Crawl);
        if (!auth.success) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { team_id, chunk } = auth;
        if (chunk?.flags?.forceZDR) {
            return res.status(400).json({ error: "Your team has zero data retention enabled. This is not supported on the v0 API. Please update your code to use the v1 API." });
        }
        redis_1.redisEvictConnection.sadd("teams_using_v0", team_id)
            .catch(error => logger_1.logger.error("Failed to add team to teams_using_v0", { error, team_id }));
        if (req.headers["x-idempotency-key"]) {
            const isIdempotencyValid = await (0, validate_1.validateIdempotencyKey)(req);
            if (!isIdempotencyValid) {
                return res.status(409).json({ error: "Idempotency key already used" });
            }
            try {
                (0, create_1.createIdempotencyKey)(req);
            }
            catch (error) {
                logger_1.logger.error(error);
                return res.status(500).json({ error: error.message });
            }
        }
        const crawlerOptions = {
            ...default_values_1.defaultCrawlerOptions,
            ...req.body.crawlerOptions,
        };
        const pageOptions = { ...default_values_1.defaultCrawlPageOptions, ...req.body.pageOptions };
        if (Array.isArray(crawlerOptions.includes)) {
            for (const x of crawlerOptions.includes) {
                try {
                    new RegExp(x);
                }
                catch (e) {
                    return res.status(400).json({ error: e.message });
                }
            }
        }
        if (Array.isArray(crawlerOptions.excludes)) {
            for (const x of crawlerOptions.excludes) {
                try {
                    new RegExp(x);
                }
                catch (e) {
                    return res.status(400).json({ error: e.message });
                }
            }
        }
        const limitCheck = req.body?.crawlerOptions?.limit ?? 1;
        const { success: creditsCheckSuccess, message: creditsCheckMessage, remainingCredits, } = await (0, credit_billing_1.checkTeamCredits)(chunk, team_id, limitCheck);
        if (!creditsCheckSuccess) {
            return res.status(402).json({
                error: "Insufficient credits. You may be requesting with a higher limit than the amount of credits you have left. If not, upgrade your plan at https://firecrawl.dev/pricing or contact us at help@firecrawl.com",
            });
        }
        // TODO: need to do this to v1
        crawlerOptions.limit = Math.min(remainingCredits, crawlerOptions.limit);
        let url = types_2.url.parse(req.body.url);
        if (!url) {
            return res.status(400).json({ error: "Url is required" });
        }
        if (typeof url !== "string") {
            return res.status(400).json({ error: "URL must be a string" });
        }
        try {
            url = (0, validateUrl_1.checkAndUpdateURL)(url).url;
        }
        catch (e) {
            return res
                .status(e instanceof Error && e.message === "Invalid URL" ? 400 : 500)
                .json({ error: e.message ?? e });
        }
        if ((0, blocklist_1.isUrlBlocked)(url, auth.chunk?.flags ?? null)) {
            return res.status(403).json({
                error: strings_1.BLOCKLISTED_URL_MESSAGE,
            });
        }
        // if (mode === "single_urls" && !url.includes(",")) { // NOTE: do we need this?
        //   try {
        //     const a = new WebScraperDataProvider();
        //     await a.setOptions({
        //       jobId: uuidv4(),
        //       mode: "single_urls",
        //       urls: [url],
        //       crawlerOptions: { ...crawlerOptions, returnOnlyUrls: true },
        //       pageOptions: pageOptions,
        //     });
        //     const docs = await a.getDocuments(false, (progress) => {
        //       job.updateProgress({
        //         current: progress.current,
        //         total: progress.total,
        //         current_step: "SCRAPING",
        //         current_url: progress.currentDocumentUrl,
        //       });
        //     });
        //     return res.json({
        //       success: true,
        //       documents: docs,
        //     });
        //   } catch (error) {
        //     logger.error(error);
        //     return res.status(500).json({ error: error.message });
        //   }
        // }
        const id = (0, uuid_1.v4)();
        await (0, crawl_log_1.logCrawl)(id, team_id);
        const { scrapeOptions, internalOptions } = (0, types_2.fromLegacyScrapeOptions)(pageOptions, undefined, undefined, team_id);
        internalOptions.disableSmartWaitCache = true; // NOTE: smart wait disabled for crawls to ensure contentful scrape, speed does not matter
        internalOptions.saveScrapeResultToGCS = process.env.GCS_FIRE_ENGINE_BUCKET_NAME ? true : false;
        delete scrapeOptions.timeout;
        const sc = {
            originUrl: url,
            crawlerOptions,
            scrapeOptions,
            internalOptions,
            team_id,
            createdAt: Date.now(),
        };
        const crawler = (0, crawl_redis_1.crawlToCrawler)(id, sc, auth.chunk?.flags ?? null);
        try {
            sc.robots = await crawler.getRobotsTxt();
        }
        catch (_) { }
        await (0, crawl_redis_1.saveCrawl)(id, sc);
        await (0, crawl_redis_1.finishCrawlKickoff)(id);
        const sitemap = sc.crawlerOptions.ignoreSitemap
            ? 0
            : await crawler.tryGetSitemap(async (urls) => {
                if (urls.length === 0)
                    return;
                let jobPriority = await (0, job_priority_1.getJobPriority)({
                    team_id,
                    basePriority: 21,
                });
                const jobs = urls.map((url) => {
                    const uuid = (0, uuid_1.v4)();
                    return {
                        name: uuid,
                        data: {
                            url,
                            mode: "single_urls",
                            crawlerOptions,
                            scrapeOptions,
                            internalOptions,
                            team_id,
                            origin: req.body.origin ?? default_values_1.defaultOrigin,
                            integration: req.body.integration,
                            crawl_id: id,
                            sitemapped: true,
                            zeroDataRetention: false, // not supported on v0
                        },
                        opts: {
                            jobId: uuid,
                            priority: jobPriority,
                        },
                    };
                });
                await (0, crawl_redis_1.lockURLs)(id, sc, jobs.map((x) => x.data.url), logger_1.logger);
                await (0, crawl_redis_1.addCrawlJobs)(id, jobs.map((x) => x.opts.jobId), logger_1.logger);
                for (const job of jobs) {
                    // add with sentry instrumentation
                    await (0, queue_jobs_1.addScrapeJob)(job.data, {}, job.opts.jobId);
                }
            });
        if (sitemap === 0) {
            await (0, crawl_redis_1.lockURL)(id, sc, url);
            // Not needed, first one should be 15.
            // const jobPriority = await getJobPriority({team_id, basePriority: 10})
            const jobId = (0, uuid_1.v4)();
            await (0, queue_jobs_1.addScrapeJob)({
                url,
                mode: "single_urls",
                crawlerOptions,
                scrapeOptions,
                internalOptions,
                team_id,
                origin: req.body.origin ?? default_values_1.defaultOrigin,
                integration: req.body.integration,
                crawl_id: id,
                zeroDataRetention: false, // not supported on v0
            }, {
                priority: 15, // prioritize request 0 of crawl jobs same as scrape jobs
            }, jobId);
            await (0, crawl_redis_1.addCrawlJob)(id, jobId, logger_1.logger);
        }
        res.json({ jobId: id });
    }
    catch (error) {
        Sentry.captureException(error);
        logger_1.logger.error(error);
        return res.status(500).json({
            error: error instanceof zod_1.ZodError ? "Invalid URL" : error.message,
        });
    }
}
//# sourceMappingURL=crawl.js.map