"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepResearchStatusController = deepResearchStatusController;
const deep_research_redis_1 = require("../../lib/deep-research/deep-research-redis");
const supabase_jobs_1 = require("../../lib/supabase-jobs");
async function deepResearchStatusController(req, res) {
    const research = await (0, deep_research_redis_1.getDeepResearch)(req.params.jobId);
    if (!research) {
        return res.status(404).json({
            success: false,
            error: "Deep research job not found",
        });
    }
    let data = null;
    if (research.status === "completed" &&
        process.env.USE_DB_AUTHENTICATION === "true") {
        const jobData = await (0, supabase_jobs_1.supabaseGetJobsById)([req.params.jobId]);
        if (jobData && jobData.length > 0) {
            data = jobData[0].docs[0];
        }
    }
    return res.status(200).json({
        success: research.status === "failed" ? false : true,
        data: {
            finalAnalysis: research.finalAnalysis,
            sources: research.sources,
            activities: research.activities,
            json: research.json,
            // completedSteps: research.completedSteps,
            // totalSteps: research.totalExpectedSteps,
        },
        error: research?.error ?? undefined,
        expiresAt: (await (0, deep_research_redis_1.getDeepResearchExpiry)(req.params.jobId)).toISOString(),
        currentDepth: research.currentDepth,
        maxDepth: research.maxDepth,
        status: research.status,
        totalUrls: research.sources.length,
        // DO NOT remove - backwards compatibility
        //@deprecated
        activities: research.activities,
        //@deprecated
        sources: research.sources,
        // summaries: research.summaries,
    });
}
//# sourceMappingURL=deep-research-status.js.map