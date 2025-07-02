"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractStep = void 0;
exports.saveExtract = saveExtract;
exports.getExtract = getExtract;
exports.updateExtract = updateExtract;
exports.getExtractExpiry = getExtractExpiry;
const redis_1 = require("../../services/redis");
const logger_1 = require("../logger");
var ExtractStep;
(function (ExtractStep) {
    ExtractStep["INITIAL"] = "initial";
    ExtractStep["MAP"] = "map";
    ExtractStep["MAP_RERANK"] = "map-rerank";
    ExtractStep["MULTI_ENTITY"] = "multi-entity";
    ExtractStep["MULTI_ENTITY_SCRAPE"] = "multi-entity-scrape";
    ExtractStep["MULTI_ENTITY_AGENT_SCRAPE"] = "multi-entity-agent-scrape";
    ExtractStep["MULTI_ENTITY_EXTRACT"] = "multi-entity-extract";
    ExtractStep["SCRAPE"] = "scrape";
    ExtractStep["EXTRACT"] = "extract";
    ExtractStep["COMPLETE"] = "complete";
})(ExtractStep || (exports.ExtractStep = ExtractStep = {}));
// Reduce TTL to 6 hours instead of 24
const EXTRACT_TTL = 6 * 60 * 60;
const STEPS_MAX_DISCOVERED_LINKS = 100;
async function saveExtract(id, extract) {
    logger_1.logger.debug("Saving extract " + id + " to Redis...");
    // Only store essential data
    const minimalExtract = {
        ...extract,
        steps: extract.steps?.map(step => ({
            step: step.step,
            startedAt: step.startedAt,
            finishedAt: step.finishedAt,
            error: step.error,
            // Only store first 20 discovered links per step
            discoveredLinks: step.discoveredLinks?.slice(0, STEPS_MAX_DISCOVERED_LINKS)
        }))
    };
    await redis_1.redisEvictConnection.set("extract:" + id, JSON.stringify(minimalExtract));
    await redis_1.redisEvictConnection.expire("extract:" + id, EXTRACT_TTL);
}
async function getExtract(id) {
    const x = await redis_1.redisEvictConnection.get("extract:" + id);
    return x ? JSON.parse(x) : null;
}
async function updateExtract(id, extract) {
    const current = await getExtract(id);
    if (!current)
        return;
    // Handle steps aggregation with cleanup
    if (extract.steps && current.steps) {
        // Keep only the last 5 steps to prevent unbounded growth
        const allSteps = [...current.steps, ...extract.steps];
        extract.steps = allSteps.slice(Math.max(0, allSteps.length - 5));
    }
    // Limit links in steps to 20 instead of 100 to reduce memory usage
    if (extract.steps) {
        extract.steps = extract.steps.map((step) => {
            if (step.discoveredLinks && step.discoveredLinks.length > STEPS_MAX_DISCOVERED_LINKS) {
                return {
                    ...step,
                    discoveredLinks: step.discoveredLinks.slice(0, STEPS_MAX_DISCOVERED_LINKS),
                };
            }
            return step;
        });
    }
    const minimalExtract = {
        ...current,
        ...extract,
        steps: extract.steps?.map(step => ({
            step: step.step,
            startedAt: step.startedAt,
            finishedAt: step.finishedAt,
            error: step.error,
            discoveredLinks: step.discoveredLinks?.slice(0, STEPS_MAX_DISCOVERED_LINKS)
        }))
    };
    console.log(minimalExtract.sessionIds);
    await redis_1.redisEvictConnection.set("extract:" + id, JSON.stringify(minimalExtract));
    await redis_1.redisEvictConnection.expire("extract:" + id, EXTRACT_TTL);
}
async function getExtractExpiry(id) {
    const d = new Date();
    const ttl = await redis_1.redisEvictConnection.pttl("extract:" + id);
    d.setMilliseconds(d.getMilliseconds() + ttl);
    d.setMilliseconds(0);
    return d;
}
//# sourceMappingURL=extract-redis.js.map