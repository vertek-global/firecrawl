"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeController = scrapeController;
const logger_1 = require("../../lib/logger");
const types_1 = require("./types");
const uuid_1 = require("uuid");
const queue_jobs_1 = require("../../services/queue-jobs");
const job_priority_1 = require("../../lib/job-priority");
const queue_service_1 = require("../../services/queue-service");
async function scrapeController(req, res) {
    const jobId = (0, uuid_1.v4)();
    const preNormalizedBody = { ...req.body };
    if (req.body.zeroDataRetention && !req.acuc?.flags?.allowZDR) {
        return res.status(400).json({
            success: false,
            error: "Zero data retention is enabled for this team. If you're interested in ZDR, please contact support@firecrawl.com",
        });
    }
    const zeroDataRetention = req.acuc?.flags?.forceZDR || req.body.zeroDataRetention;
    const logger = logger_1.logger.child({
        method: "scrapeController",
        jobId,
        scrapeId: jobId,
        teamId: req.auth.team_id,
        team_id: req.auth.team_id,
        zeroDataRetention,
    });
    logger.debug("Scrape " + jobId + " starting", {
        scrapeId: jobId,
        request: req.body,
        originalRequest: preNormalizedBody,
        account: req.account,
    });
    req.body = types_1.scrapeRequestSchema.parse(req.body);
    const origin = req.body.origin;
    const timeout = req.body.timeout;
    const startTime = new Date().getTime();
    const jobPriority = await (0, job_priority_1.getJobPriority)({
        team_id: req.auth.team_id,
        basePriority: 10,
    });
    const isDirectToBullMQ = process.env.SEARCH_PREVIEW_TOKEN !== undefined && process.env.SEARCH_PREVIEW_TOKEN === req.body.__searchPreviewToken;
    await (0, queue_jobs_1.addScrapeJob)({
        url: req.body.url,
        mode: "single_urls",
        team_id: req.auth.team_id,
        scrapeOptions: {
            ...req.body,
            ...(req.body.__experimental_cache ? {
                maxAge: req.body.maxAge ?? 4 * 60 * 60 * 1000, // 4 hours
            } : {}),
        },
        internalOptions: {
            teamId: req.auth.team_id,
            saveScrapeResultToGCS: process.env.GCS_FIRE_ENGINE_BUCKET_NAME ? true : false,
            unnormalizedSourceURL: preNormalizedBody.url,
            bypassBilling: isDirectToBullMQ,
            zeroDataRetention,
        },
        origin,
        integration: req.body.integration,
        startTime,
        zeroDataRetention,
    }, {}, jobId, jobPriority, isDirectToBullMQ);
    const totalWait = (req.body.waitFor ?? 0) +
        (req.body.actions ?? []).reduce((a, x) => (x.type === "wait" ? (x.milliseconds ?? 0) : 0) + a, 0);
    let doc;
    try {
        doc = await (0, queue_jobs_1.waitForJob)(jobId, timeout + totalWait);
    }
    catch (e) {
        logger.error(`Error in scrapeController`, {
            startTime,
        });
        if (zeroDataRetention) {
            await (0, queue_service_1.getScrapeQueue)().remove(jobId);
        }
        if (e instanceof Error &&
            (e.message.startsWith("Job wait") || e.message === "timeout")) {
            return res.status(408).json({
                success: false,
                error: "Request timed out",
            });
        }
        else {
            return res.status(500).json({
                success: false,
                error: `(Internal server error) - ${e && e.message ? e.message : e}`,
            });
        }
    }
    await (0, queue_service_1.getScrapeQueue)().remove(jobId);
    if (!req.body.formats.includes("rawHtml")) {
        if (doc && doc.rawHtml) {
            delete doc.rawHtml;
        }
    }
    return res.status(200).json({
        success: true,
        data: doc,
        scrape_id: origin?.includes("website") ? jobId : undefined,
    });
}
//# sourceMappingURL=scrape.js.map