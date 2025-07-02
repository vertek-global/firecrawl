"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisEvictConnection = exports.deleteKey = exports.getValue = exports.setValue = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const rate_limiter_1 = require("./rate-limiter");
const logger_1 = require("../lib/logger");
// Listen to 'error' events to the Redis connection
rate_limiter_1.redisRateLimitClient.on("error", (error) => {
    try {
        if (error.message === "ECONNRESET") {
            logger_1.logger.error("Connection to Redis Session Rate Limit Store timed out.");
        }
        else if (error.message === "ECONNREFUSED") {
            logger_1.logger.error("Connection to Redis Session Rate Limit Store refused!");
        }
        else
            logger_1.logger.error(error);
    }
    catch (error) { }
});
// Listen to 'reconnecting' event to Redis
rate_limiter_1.redisRateLimitClient.on("reconnecting", (err) => {
    try {
        if (rate_limiter_1.redisRateLimitClient.status === "reconnecting")
            logger_1.logger.info("Reconnecting to Redis Session Rate Limit Store...");
        else
            logger_1.logger.error("Error reconnecting to Redis Session Rate Limit Store.");
    }
    catch (error) { }
});
// Listen to the 'connect' event to Redis
rate_limiter_1.redisRateLimitClient.on("connect", (err) => {
    try {
        if (!err)
            logger_1.logger.info("Connected to Redis Session Rate Limit Store!");
    }
    catch (error) { }
});
/**
 * Set a value in Redis with an optional expiration time.
 * @param {string} key The key under which to store the value.
 * @param {string} value The value to store.
 * @param {number} [expire] Optional expiration time in seconds.
 */
const setValue = async (key, value, expire, nx = false) => {
    if (expire && !nx) {
        await rate_limiter_1.redisRateLimitClient.set(key, value, "EX", expire);
    }
    else {
        await rate_limiter_1.redisRateLimitClient.set(key, value);
    }
    if (expire && nx) {
        await rate_limiter_1.redisRateLimitClient.expire(key, expire, "NX");
    }
};
exports.setValue = setValue;
/**
 * Get a value from Redis.
 * @param {string} key The key of the value to retrieve.
 * @returns {Promise<string|null>} The value, if found, otherwise null.
 */
const getValue = async (key) => {
    const value = await rate_limiter_1.redisRateLimitClient.get(key);
    return value;
};
exports.getValue = getValue;
/**
 * Delete a key from Redis.
 * @param {string} key The key to delete.
 */
const deleteKey = async (key) => {
    await rate_limiter_1.redisRateLimitClient.del(key);
};
exports.deleteKey = deleteKey;
const redisEvictURL = process.env.REDIS_EVICT_URL ?? process.env.REDIS_RATE_LIMIT_URL;
exports.redisEvictConnection = new ioredis_1.default(redisEvictURL);
//# sourceMappingURL=redis.js.map