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
exports.crawlPreviewController = crawlPreviewController;
const auth_1 = require("../auth");
const types_1 = require("../../../src/types");
const blocklist_1 = require("../../../src/scraper/WebScraper/utils/blocklist");
const uuid_1 = require("uuid");
const logger_1 = require("../../../src/lib/logger");
const crawl_redis_1 = require("../../../src/lib/crawl-redis");
const queue_jobs_1 = require("../../../src/services/queue-jobs");
const validateUrl_1 = require("../../../src/lib/validateUrl");
const Sentry = __importStar(require("@sentry/node"));
const types_2 = require("../v1/types");
const strings_1 = require("../../lib/strings");
async function crawlPreviewController(req, res) {
    try {
        const auth = await (0, auth_1.authenticateUser)(req, res, types_1.RateLimiterMode.Preview);
        const incomingIP = (req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress);
        const iptoken = incomingIP + process.env.PREVIEW_TOKEN;
        const team_id = `preview_${iptoken}`;
        if (!auth.success) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (auth.chunk?.flags?.forceZDR) {
            return res.status(400).json({ error: "Your team has zero data retention enabled. This is not supported on the v0 API. Please update your code to use the v1 API." });
        }
        let url = req.body.url;
        if (!url) {
            return res.status(400).json({ error: "Url is required" });
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
        const crawlerOptions = req.body.crawlerOptions ?? {};
        const pageOptions = req.body.pageOptions ?? {
            onlyMainContent: false,
            includeHtml: false,
            removeTags: [],
        };
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
        let robots;
        try {
            robots = await this.getRobotsTxt();
        }
        catch (_) { }
        const { scrapeOptions, internalOptions } = (0, types_2.fromLegacyScrapeOptions)(pageOptions, undefined, undefined, team_id);
        const sc = {
            originUrl: url,
            crawlerOptions,
            scrapeOptions,
            internalOptions,
            team_id,
            robots,
            createdAt: Date.now(),
        };
        await (0, crawl_redis_1.saveCrawl)(id, sc);
        const crawler = (0, crawl_redis_1.crawlToCrawler)(id, sc, auth.chunk?.flags ?? null);
        await (0, crawl_redis_1.finishCrawlKickoff)(id);
        const sitemap = sc.crawlerOptions?.ignoreSitemap
            ? 0
            : await crawler.tryGetSitemap(async (urls) => {
                for (const url of urls) {
                    await (0, crawl_redis_1.lockURL)(id, sc, url);
                    const jobId = (0, uuid_1.v4)();
                    await (0, queue_jobs_1.addScrapeJob)({
                        url,
                        mode: "single_urls",
                        team_id,
                        crawlerOptions,
                        scrapeOptions,
                        internalOptions,
                        origin: "website-preview",
                        crawl_id: id,
                        sitemapped: true,
                        zeroDataRetention: false, // not supported on v0
                    }, {}, jobId);
                    await (0, crawl_redis_1.addCrawlJob)(id, jobId, logger_1.logger);
                }
            });
        if (sitemap === 0) {
            await (0, crawl_redis_1.lockURL)(id, sc, url);
            const jobId = (0, uuid_1.v4)();
            await (0, queue_jobs_1.addScrapeJob)({
                url,
                mode: "single_urls",
                team_id,
                crawlerOptions,
                scrapeOptions,
                internalOptions,
                origin: "website-preview",
                crawl_id: id,
                zeroDataRetention: false, // not supported on v0
            }, {}, jobId);
            await (0, crawl_redis_1.addCrawlJob)(id, jobId, logger_1.logger);
        }
        res.json({ jobId: id });
    }
    catch (error) {
        Sentry.captureException(error);
        logger_1.logger.error(error);
        return res.status(500).json({ error: error.message });
    }
}
//# sourceMappingURL=crawlPreview.js.map