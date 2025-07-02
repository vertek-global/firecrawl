"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExtractJob = getExtractJob;
exports.extractStatusController = extractStatusController;
const extract_redis_1 = require("../../lib/extract/extract-redis");
const queue_service_1 = require("../../services/queue-service");
const supabase_jobs_1 = require("../../lib/supabase-jobs");
async function getExtractJob(id) {
    const [bullJob, dbJob] = await Promise.all([
        (0, queue_service_1.getExtractQueue)().getJob(id),
        (process.env.USE_DB_AUTHENTICATION === "true" ? (0, supabase_jobs_1.supabaseGetJobById)(id) : null),
    ]);
    if (!bullJob && !dbJob)
        return null;
    const data = dbJob?.docs ?? bullJob?.returnvalue?.data;
    const job = {
        id,
        getState: bullJob ? bullJob.getState.bind(bullJob) : (() => dbJob.success ? "completed" : "failed"),
        returnvalue: data,
        data: {
            scrapeOptions: bullJob ? bullJob.data.scrapeOptions : dbJob.page_options,
            teamId: bullJob ? bullJob.data.teamId : dbJob.team_id,
        },
        timestamp: bullJob ? bullJob.timestamp : new Date(dbJob.date_added).valueOf(),
        failedReason: (bullJob ? bullJob.failedReason : dbJob.message) || undefined,
    };
    return job;
}
async function extractStatusController(req, res) {
    const extract = await (0, extract_redis_1.getExtract)(req.params.jobId);
    let status = extract?.status;
    if (extract && extract.team_id !== req.auth.team_id) {
        return res.status(404).json({
            success: false,
            error: "Extract job not found",
        });
    }
    let data = [];
    if (!extract || extract.status === "completed") {
        const jobData = await getExtractJob(req.params.jobId);
        if ((!jobData && !extract) || (jobData && jobData.data.teamId !== req.auth.team_id)) {
            return res.status(404).json({
                success: false,
                error: "Extract job not found",
            });
        }
        if (jobData) {
            const jobStatus = await jobData.getState();
            if (jobStatus === "completed") {
                status = "completed";
            }
            else if (jobStatus === "failed") {
                status = "failed";
            }
            else {
                status = "processing";
            }
        }
        if (!jobData?.returnvalue) {
            // if we got in the split-second where the redis is updated but the bull isn't
            // just pretend it's still processing - MG
            status = "processing";
        }
        else {
            data = jobData.returnvalue ?? [];
        }
    }
    return res.status(200).json({
        success: status === "failed" ? false : true,
        data,
        status,
        error: extract?.error ?? undefined,
        expiresAt: (await (0, extract_redis_1.getExtractExpiry)(req.params.jobId)).toISOString(),
        steps: extract?.showSteps ? extract.steps : undefined,
        llmUsage: extract?.showLLMUsage ? extract.llmUsage : undefined,
        sources: extract?.showSources ? extract.sources : undefined,
        costTracking: extract?.showCostTracking ? extract.costTracking : undefined,
        sessionIds: extract?.sessionIds ? extract.sessionIds : undefined,
        tokensUsed: extract?.tokensBilled ? extract.tokensBilled : undefined,
    });
}
//# sourceMappingURL=extract-status.js.map