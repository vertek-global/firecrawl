"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeDocument_F0 = scrapeDocument_F0;
const types_1 = require("../../../controllers/v1/types");
const queue_service_1 = require("../../../services/queue-service");
const queue_jobs_1 = require("../../../services/queue-jobs");
const queue_jobs_2 = require("../../../services/queue-jobs");
const job_priority_1 = require("../../job-priority");
async function scrapeDocument_F0(options, urlTraces, logger, internalScrapeOptions = { onlyMainContent: false }) {
    const trace = urlTraces.find((t) => t.url === options.url);
    if (trace) {
        trace.status = "scraped";
        trace.timing.scrapedAt = new Date().toISOString();
    }
    async function attemptScrape(timeout) {
        const jobId = crypto.randomUUID();
        const jobPriority = await (0, job_priority_1.getJobPriority)({
            team_id: options.teamId,
            basePriority: 10,
            from_extract: true,
        });
        await (0, queue_jobs_2.addScrapeJob)({
            url: options.url,
            mode: "single_urls",
            team_id: options.teamId,
            scrapeOptions: types_1.scrapeOptions.parse({
                ...internalScrapeOptions,
                maxAge: 4 * 60 * 60 * 1000,
            }),
            internalOptions: {
                teamId: options.teamId,
                bypassBilling: true,
            },
            origin: options.origin,
            is_scrape: true,
            from_extract: true,
            startTime: Date.now(),
            zeroDataRetention: false, // not supported
        }, {}, jobId, jobPriority);
        const doc = await (0, queue_jobs_1.waitForJob)(jobId, timeout);
        await (0, queue_service_1.getScrapeQueue)().remove(jobId);
        if (trace) {
            trace.timing.completedAt = new Date().toISOString();
            trace.contentStats = {
                rawContentLength: doc.markdown?.length || 0,
                processedContentLength: doc.markdown?.length || 0,
                tokensUsed: 0,
            };
        }
        return doc;
    }
    try {
        try {
            logger.debug("Attempting scrape...");
            const x = await attemptScrape(options.timeout);
            logger.debug("Scrape finished!");
            return x;
        }
        catch (timeoutError) {
            logger.warn("Scrape failed.", { error: timeoutError });
            if (options.isSingleUrl) {
                // For single URLs, try again with double timeout
                logger.debug("Attempting scrape...");
                const x = await attemptScrape(options.timeout * 2);
                logger.debug("Scrape finished!");
                return x;
            }
            throw timeoutError;
        }
    }
    catch (error) {
        logger.error(`error in scrapeDocument`, { error });
        if (trace) {
            trace.status = "error";
            trace.error = error.message;
        }
        return null;
    }
}
//# sourceMappingURL=document-scraper-f0.js.map