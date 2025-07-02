"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepResearchStep = void 0;
exports.saveDeepResearch = saveDeepResearch;
exports.getDeepResearch = getDeepResearch;
exports.updateDeepResearch = updateDeepResearch;
exports.getDeepResearchExpiry = getDeepResearchExpiry;
const redis_1 = require("../../services/redis");
const logger_1 = require("../logger");
var DeepResearchStep;
(function (DeepResearchStep) {
    DeepResearchStep["INITIAL"] = "initial";
    DeepResearchStep["SEARCH"] = "search";
    DeepResearchStep["EXTRACT"] = "extract";
    DeepResearchStep["ANALYZE"] = "analyze";
    DeepResearchStep["SYNTHESIS"] = "synthesis";
    DeepResearchStep["COMPLETE"] = "complete";
})(DeepResearchStep || (exports.DeepResearchStep = DeepResearchStep = {}));
// TTL of 6 hours
const DEEP_RESEARCH_TTL = 6 * 60 * 60;
async function saveDeepResearch(id, research) {
    logger_1.logger.debug("Saving deep research " + id + " to Redis...");
    await redis_1.redisEvictConnection.set("deep-research:" + id, JSON.stringify(research));
    await redis_1.redisEvictConnection.expire("deep-research:" + id, DEEP_RESEARCH_TTL);
}
async function getDeepResearch(id) {
    const x = await redis_1.redisEvictConnection.get("deep-research:" + id);
    return x ? JSON.parse(x) : null;
}
async function updateDeepResearch(id, research) {
    const current = await getDeepResearch(id);
    if (!current)
        return;
    const updatedResearch = {
        ...current,
        ...research,
        // Append new activities if provided
        activities: research.activities
            ? [...(current.activities || []), ...research.activities]
            : current.activities,
        // Append new findings if provided  
        // findings: research.findings
        //   ? [...(current.findings || []), ...research.findings]
        //   : current.findings,
        // Append new sources if provided
        sources: research.sources
            ? [...(current.sources || []), ...research.sources]
            : current.sources,
        // Append new summaries if provided
        summaries: research.summaries
            ? [...(current.summaries || []), ...research.summaries]
            : current.summaries
    };
    await redis_1.redisEvictConnection.set("deep-research:" + id, JSON.stringify(updatedResearch));
    await redis_1.redisEvictConnection.expire("deep-research:" + id, DEEP_RESEARCH_TTL);
}
async function getDeepResearchExpiry(id) {
    const d = new Date();
    const ttl = await redis_1.redisEvictConnection.pttl("deep-research:" + id);
    d.setMilliseconds(d.getMilliseconds() + ttl);
    d.setMilliseconds(0);
    return d;
}
//# sourceMappingURL=deep-research-redis.js.map