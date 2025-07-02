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
exports.searchAndScrapeSearchResult = searchAndScrapeSearchResult;
exports.searchController = searchController;
const types_1 = require("./types");
const credit_billing_1 = require("../../services/billing/credit_billing");
const uuid_1 = require("uuid");
const queue_jobs_1 = require("../../services/queue-jobs");
const log_job_1 = require("../../services/logging/log_job");
const job_priority_1 = require("../../lib/job-priority");
const queue_service_1 = require("../../services/queue-service");
const search_1 = require("../../search");
const blocklist_1 = require("../../scraper/WebScraper/utils/blocklist");
const Sentry = __importStar(require("@sentry/node"));
const strings_1 = require("../../lib/strings");
const logger_1 = require("../../lib/logger");
const extraction_service_1 = require("../../lib/extract/extraction-service");
// Used for deep research
async function searchAndScrapeSearchResult(query, options, logger, costTracking, flags) {
    try {
        const searchResults = await (0, search_1.search)({
            query,
            num_results: 5,
        });
        const documents = await Promise.all(searchResults.map((result) => scrapeSearchResult({
            url: result.url,
            title: result.title,
            description: result.description,
        }, options, logger, costTracking, flags)));
        return documents;
    }
    catch (error) {
        return [];
    }
}
async function scrapeSearchResult(searchResult, options, logger, costTracking, flags, directToBullMQ = false, isSearchPreview = false) {
    const jobId = (0, uuid_1.v4)();
    const jobPriority = await (0, job_priority_1.getJobPriority)({
        team_id: options.teamId,
        basePriority: 10,
    });
    const zeroDataRetention = flags?.forceZDR ?? false;
    try {
        if ((0, blocklist_1.isUrlBlocked)(searchResult.url, flags)) {
            throw new Error("Could not scrape url: " + strings_1.BLOCKLISTED_URL_MESSAGE);
        }
        logger.info("Adding scrape job", {
            scrapeId: jobId,
            url: searchResult.url,
            teamId: options.teamId,
            origin: options.origin,
            zeroDataRetention,
        });
        await (0, queue_jobs_1.addScrapeJob)({
            url: searchResult.url,
            mode: "single_urls",
            team_id: options.teamId,
            scrapeOptions: {
                ...options.scrapeOptions,
                maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
            },
            internalOptions: { teamId: options.teamId, bypassBilling: true, zeroDataRetention },
            origin: options.origin,
            is_scrape: true,
            startTime: Date.now(),
            zeroDataRetention,
        }, {}, jobId, jobPriority, directToBullMQ);
        const doc = await (0, queue_jobs_1.waitForJob)(jobId, options.timeout);
        logger.info("Scrape job completed", {
            scrapeId: jobId,
            url: searchResult.url,
            teamId: options.teamId,
            origin: options.origin,
        });
        await (0, queue_service_1.getScrapeQueue)().remove(jobId);
        // Move SERP results to top level
        return {
            title: searchResult.title,
            description: searchResult.description,
            url: searchResult.url,
            ...doc,
        };
    }
    catch (error) {
        logger.error(`Error in scrapeSearchResult: ${error}`, {
            scrapeId: jobId,
            url: searchResult.url,
            teamId: options.teamId,
        });
        let statusCode = 0;
        if (error?.message?.includes("Could not scrape url")) {
            statusCode = 403;
        }
        // Return a minimal document with SERP results at top level
        return {
            title: searchResult.title,
            description: searchResult.description,
            url: searchResult.url,
            metadata: {
                statusCode,
                error: error.message,
                proxyUsed: "basic",
            },
        };
    }
}
async function searchController(req, res) {
    const jobId = (0, uuid_1.v4)();
    let logger = logger_1.logger.child({
        jobId,
        teamId: req.auth.team_id,
        module: "search",
        method: "searchController",
        zeroDataRetention: req.acuc?.flags?.forceZDR,
    });
    if (req.acuc?.flags?.forceZDR) {
        return res.status(400).json({ success: false, error: "Your team has zero data retention enabled. This is not supported on search. Please contact support@firecrawl.com to unblock this feature." });
    }
    let responseData = {
        success: true,
        data: [],
    };
    const startTime = new Date().getTime();
    const costTracking = new extraction_service_1.CostTracking();
    const isSearchPreview = process.env.SEARCH_PREVIEW_TOKEN !== undefined && process.env.SEARCH_PREVIEW_TOKEN === req.body.__searchPreviewToken;
    try {
        req.body = types_1.searchRequestSchema.parse(req.body);
        logger = logger.child({
            query: req.body.query,
            origin: req.body.origin,
        });
        let limit = req.body.limit;
        // Buffer results by 50% to account for filtered URLs
        const num_results_buffer = Math.floor(limit * 2);
        logger.info("Searching for results");
        let searchResults = await (0, search_1.search)({
            query: req.body.query,
            advanced: false,
            num_results: num_results_buffer,
            tbs: req.body.tbs,
            filter: req.body.filter,
            lang: req.body.lang,
            country: req.body.country,
            location: req.body.location,
        });
        if (req.body.ignoreInvalidURLs) {
            searchResults = searchResults.filter((result) => !(0, blocklist_1.isUrlBlocked)(result.url, req.acuc?.flags ?? null));
        }
        logger.info("Searching completed", {
            num_results: searchResults.length,
        });
        // Filter blocked URLs early to avoid unnecessary billing
        if (searchResults.length > limit) {
            searchResults = searchResults.slice(0, limit);
        }
        if (searchResults.length === 0) {
            logger.info("No search results found");
            responseData.warning = "No search results found";
        }
        else if (!req.body.scrapeOptions.formats ||
            req.body.scrapeOptions.formats.length === 0) {
            responseData.data = searchResults.map((r) => ({
                url: r.url,
                title: r.title,
                description: r.description,
            }));
        }
        else {
            logger.info("Scraping search results");
            const scrapePromises = searchResults.map((result) => scrapeSearchResult(result, {
                teamId: req.auth.team_id,
                origin: req.body.origin,
                timeout: req.body.timeout,
                scrapeOptions: req.body.scrapeOptions,
            }, logger, costTracking, req.acuc?.flags ?? null, (req.acuc?.price_credits ?? 0) <= 3000, isSearchPreview));
            const docs = await Promise.all(scrapePromises);
            logger.info("Scraping completed", {
                num_docs: docs.length,
            });
            const filteredDocs = docs.filter((doc) => doc.serpResults || (doc.markdown && doc.markdown.trim().length > 0));
            logger.info("Filtering completed", {
                num_docs: filteredDocs.length,
            });
            if (filteredDocs.length === 0) {
                responseData.data = docs;
                responseData.warning = "No content found in search results";
            }
            else {
                responseData.data = filteredDocs;
            }
        }
        // TODO: This is horrid. Fix soon - mogery
        const credits_billed = responseData.data.reduce((a, x) => {
            if (x.metadata?.numPages !== undefined && x.metadata.numPages > 0 && req.body.scrapeOptions?.parsePDF !== false) {
                return a + x.metadata.numPages;
            }
            else {
                return a + 1;
            }
        }, 0);
        // Bill team once for all successful results
        if (!isSearchPreview) {
            (0, credit_billing_1.billTeam)(req.auth.team_id, req.acuc?.sub_id, credits_billed).catch((error) => {
                logger.error(`Failed to bill team ${req.auth.team_id} for ${responseData.data.length} credits: ${error}`);
            });
        }
        const endTime = new Date().getTime();
        const timeTakenInSeconds = (endTime - startTime) / 1000;
        logger.info("Logging job", {
            num_docs: responseData.data.length,
            time_taken: timeTakenInSeconds,
        });
        (0, log_job_1.logJob)({
            job_id: jobId,
            success: true,
            num_docs: responseData.data.length,
            docs: responseData.data,
            time_taken: timeTakenInSeconds,
            team_id: req.auth.team_id,
            mode: "search",
            url: req.body.query,
            scrapeOptions: req.body.scrapeOptions,
            origin: req.body.origin,
            integration: req.body.integration,
            cost_tracking: costTracking,
            credits_billed,
            zeroDataRetention: false, // not supported
        }, false, isSearchPreview);
        return res.status(200).json(responseData);
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message.startsWith("Job wait") || error.message === "timeout")) {
            return res.status(408).json({
                success: false,
                error: "Request timed out",
            });
        }
        Sentry.captureException(error);
        logger.error("Unhandled error occurred in search", { error });
        return res.status(500).json({
            success: false,
            error: error.message,
        });
    }
}
//# sourceMappingURL=search.js.map