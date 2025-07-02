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
exports.searchHelper = searchHelper;
exports.searchController = searchController;
const credit_billing_1 = require("../../services/billing/credit_billing");
const auth_1 = require("../auth");
const types_1 = require("../../types");
const log_job_1 = require("../../services/logging/log_job");
const search_1 = require("../../search");
const blocklist_1 = require("../../scraper/WebScraper/utils/blocklist");
const uuid_1 = require("uuid");
const logger_1 = require("../../lib/logger");
const queue_service_1 = require("../../services/queue-service");
const redis_1 = require("../../../src/services/redis");
const queue_jobs_1 = require("../../services/queue-jobs");
const Sentry = __importStar(require("@sentry/node"));
const job_priority_1 = require("../../lib/job-priority");
const types_2 = require("../v1/types");
async function searchHelper(jobId, req, team_id, subscription_id, crawlerOptions, pageOptions, searchOptions, flags) {
    const query = req.body.query;
    const advanced = false;
    if (!query) {
        return { success: false, error: "Query is required", returnCode: 400 };
    }
    const tbs = searchOptions.tbs ?? undefined;
    const filter = searchOptions.filter ?? undefined;
    let num_results = Math.min(searchOptions.limit ?? 7, 10);
    if (team_id === "d97c4ceb-290b-4957-8432-2b2a02727d95") {
        num_results = 1;
    }
    const num_results_buffer = Math.floor(num_results * 1.5);
    let res = await (0, search_1.search)({
        query: query,
        advanced: advanced,
        num_results: num_results_buffer,
        tbs: tbs,
        filter: filter,
        lang: searchOptions.lang ?? "en",
        country: searchOptions.country ?? "us",
        location: searchOptions.location,
    });
    let justSearch = pageOptions.fetchPageContent === false;
    const { scrapeOptions, internalOptions } = (0, types_2.fromLegacyCombo)(pageOptions, undefined, 60000, crawlerOptions, team_id);
    if (justSearch) {
        (0, credit_billing_1.billTeam)(team_id, subscription_id, res.length).catch((error) => {
            logger_1.logger.error(`Failed to bill team ${team_id} for ${res.length} credits: ${error}`);
            // Optionally, you could notify an admin or add to a retry queue here
        });
        return { success: true, data: res, returnCode: 200 };
    }
    res = res.filter((r) => !(0, blocklist_1.isUrlBlocked)(r.url, flags));
    if (res.length > num_results) {
        res = res.slice(0, num_results);
    }
    if (res.length === 0) {
        return { success: true, error: "No search results found", returnCode: 200 };
    }
    const jobPriority = await (0, job_priority_1.getJobPriority)({ team_id, basePriority: 20 });
    // filter out social media links
    const jobDatas = res.map((x) => {
        const url = x.url;
        const uuid = (0, uuid_1.v4)();
        return {
            name: uuid,
            data: {
                url,
                mode: "single_urls",
                team_id: team_id,
                scrapeOptions,
                internalOptions,
                startTime: Date.now(),
                zeroDataRetention: false, // not supported on v0
            },
            opts: {
                jobId: uuid,
                priority: jobPriority,
            },
        };
    });
    // TODO: addScrapeJobs
    for (const job of jobDatas) {
        await (0, queue_jobs_1.addScrapeJob)(job.data, {}, job.opts.jobId, job.opts.priority);
    }
    const docs = (await Promise.all(jobDatas.map((x) => (0, queue_jobs_1.waitForJob)(x.opts.jobId, 60000)))).map((x) => (0, types_2.toLegacyDocument)(x, internalOptions));
    if (docs.length === 0) {
        return { success: true, error: "No search results found", returnCode: 200 };
    }
    const sq = (0, queue_service_1.getScrapeQueue)();
    await Promise.all(jobDatas.map((x) => sq.remove(x.opts.jobId)));
    // make sure doc.content is not empty
    const filteredDocs = docs.filter((doc) => doc && doc.content && doc.content.trim().length > 0);
    if (filteredDocs.length === 0) {
        return {
            success: true,
            error: "No page found",
            returnCode: 200,
            data: docs,
        };
    }
    return {
        success: true,
        data: filteredDocs,
        returnCode: 200,
    };
}
async function searchController(req, res) {
    try {
        // make sure to authenticate user first, Bearer <token>
        const auth = await (0, auth_1.authenticateUser)(req, res, types_1.RateLimiterMode.Search);
        if (!auth.success) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { team_id, chunk } = auth;
        if (chunk?.flags?.forceZDR) {
            return res.status(400).json({ error: "Your team has zero data retention enabled. This is not supported on the v0 API. Please update your code to use the v1 API." });
        }
        redis_1.redisEvictConnection.sadd("teams_using_v0", team_id)
            .catch(error => logger_1.logger.error("Failed to add team to teams_using_v0", { error, team_id }));
        const crawlerOptions = req.body.crawlerOptions ?? {};
        const pageOptions = req.body.pageOptions ?? {
            includeHtml: req.body.pageOptions?.includeHtml ?? false,
            onlyMainContent: req.body.pageOptions?.onlyMainContent ?? false,
            fetchPageContent: req.body.pageOptions?.fetchPageContent ?? true,
            removeTags: req.body.pageOptions?.removeTags ?? [],
            fallback: req.body.pageOptions?.fallback ?? false,
        };
        const origin = req.body.origin ?? "api";
        const searchOptions = req.body.searchOptions ?? { limit: 5 };
        const jobId = (0, uuid_1.v4)();
        try {
            const { success: creditsCheckSuccess, message: creditsCheckMessage } = await (0, credit_billing_1.checkTeamCredits)(chunk, team_id, 1);
            if (!creditsCheckSuccess) {
                return res.status(402).json({ error: "Insufficient credits" });
            }
        }
        catch (error) {
            Sentry.captureException(error);
            logger_1.logger.error(error);
            return res.status(500).json({ error: "Internal server error" });
        }
        const startTime = new Date().getTime();
        const result = await searchHelper(jobId, req, team_id, chunk?.sub_id, crawlerOptions, pageOptions, searchOptions, chunk?.flags ?? null);
        const endTime = new Date().getTime();
        const timeTakenInSeconds = (endTime - startTime) / 1000;
        (0, log_job_1.logJob)({
            job_id: jobId,
            success: result.success,
            message: result.error,
            num_docs: result.data ? result.data.length : 0,
            docs: result.data,
            time_taken: timeTakenInSeconds,
            team_id: team_id,
            mode: "search",
            url: req.body.query,
            scrapeOptions: (0, types_2.fromLegacyScrapeOptions)(req.body.pageOptions, undefined, 60000, team_id),
            crawlerOptions: crawlerOptions,
            origin,
            integration: req.body.integration,
            zeroDataRetention: false, // not supported
        });
        return res.status(result.returnCode).json(result);
    }
    catch (error) {
        if (error instanceof Error &&
            (error.message.startsWith("Job wait") || error.message === "timeout")) {
            return res.status(408).json({ error: "Request timed out" });
        }
        Sentry.captureException(error);
        logger_1.logger.error("Unhandled error occurred in search", { error });
        return res.status(500).json({ error: error.message });
    }
}
//# sourceMappingURL=search.js.map