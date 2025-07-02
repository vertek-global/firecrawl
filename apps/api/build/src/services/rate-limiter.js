"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSuiteRateLimiter = exports.redisRateLimitClient = void 0;
exports.getRateLimiter = getRateLimiter;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const ioredis_1 = __importDefault(require("ioredis"));
exports.redisRateLimitClient = new ioredis_1.default(process.env.REDIS_RATE_LIMIT_URL);
const createRateLimiter = (keyPrefix, points) => new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: exports.redisRateLimitClient,
    keyPrefix,
    points,
    duration: 60, // Duration in seconds
});
exports.testSuiteRateLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
    storeClient: exports.redisRateLimitClient,
    keyPrefix: "test-suite",
    points: 10000,
    duration: 60, // Duration in seconds
});
const fallbackRateLimits = {
    crawl: 15,
    scrape: 100,
    search: 100,
    map: 100,
    extract: 100,
    preview: 25,
    extractStatus: 25000,
    crawlStatus: 25000,
    extractAgentPreview: 10,
    scrapeAgentPreview: 10,
};
function getRateLimiter(mode, rate_limits) {
    return createRateLimiter(`${mode}`, (rate_limits?.[mode] ?? fallbackRateLimits?.[mode] ?? 500));
}
//# sourceMappingURL=rate-limiter.js.map