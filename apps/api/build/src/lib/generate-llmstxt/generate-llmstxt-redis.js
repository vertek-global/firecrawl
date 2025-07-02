"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveGeneratedLlmsTxt = saveGeneratedLlmsTxt;
exports.getGeneratedLlmsTxt = getGeneratedLlmsTxt;
exports.updateGeneratedLlmsTxt = updateGeneratedLlmsTxt;
exports.getGeneratedLlmsTxtExpiry = getGeneratedLlmsTxtExpiry;
exports.updateGeneratedLlmsTxtStatus = updateGeneratedLlmsTxtStatus;
const redis_1 = require("../../services/redis");
const logger_1 = require("../logger");
// TTL of 24 hours
const GENERATION_TTL = 24 * 60 * 60;
async function saveGeneratedLlmsTxt(id, data) {
    logger_1.logger.debug("Saving llmstxt generation " + id + " to Redis...");
    await redis_1.redisEvictConnection.set("generation:" + id, JSON.stringify(data));
    await redis_1.redisEvictConnection.expire("generation:" + id, GENERATION_TTL);
}
async function getGeneratedLlmsTxt(id) {
    const x = await redis_1.redisEvictConnection.get("generation:" + id);
    return x ? JSON.parse(x) : null;
}
async function updateGeneratedLlmsTxt(id, data) {
    const current = await getGeneratedLlmsTxt(id);
    if (!current)
        return;
    const updatedGeneration = {
        ...current,
        ...data
    };
    await redis_1.redisEvictConnection.set("generation:" + id, JSON.stringify(updatedGeneration));
    await redis_1.redisEvictConnection.expire("generation:" + id, GENERATION_TTL);
}
async function getGeneratedLlmsTxtExpiry(id) {
    const d = new Date();
    const ttl = await redis_1.redisEvictConnection.pttl("generation:" + id);
    d.setMilliseconds(d.getMilliseconds() + ttl);
    d.setMilliseconds(0);
    return d;
}
// Convenience method for status updates
async function updateGeneratedLlmsTxtStatus(id, status, generatedText, fullText, error) {
    const updates = { status };
    if (generatedText !== undefined)
        updates.generatedText = generatedText;
    if (fullText !== undefined)
        updates.fullText = fullText;
    if (error !== undefined)
        updates.error = error;
    await updateGeneratedLlmsTxt(id, updates);
}
//# sourceMappingURL=generate-llmstxt-redis.js.map