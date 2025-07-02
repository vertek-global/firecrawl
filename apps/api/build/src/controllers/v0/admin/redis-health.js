"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisHealthController = redisHealthController;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../../../lib/logger");
const rate_limiter_1 = require("../../../services/rate-limiter");
async function redisHealthController(req, res) {
    const retryOperation = async (operation, retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                if (attempt === retries)
                    throw error;
                logger_1.logger.warn(`Attempt ${attempt} failed: ${error.message}. Retrying...`);
                await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
            }
        }
    };
    try {
        const queueRedis = new ioredis_1.default(process.env.REDIS_URL);
        const testKey = "test";
        const testValue = "test";
        // Test queueRedis
        let queueRedisHealth;
        try {
            await retryOperation(() => queueRedis.set(testKey, testValue));
            queueRedisHealth = await retryOperation(() => queueRedis.get(testKey));
            await retryOperation(() => queueRedis.del(testKey));
        }
        catch (error) {
            logger_1.logger.error(`queueRedis health check failed: ${error}`);
            queueRedisHealth = null;
        }
        // Test redisRateLimitClient
        let redisRateLimitHealth;
        try {
            await retryOperation(() => rate_limiter_1.redisRateLimitClient.set(testKey, testValue));
            redisRateLimitHealth = await retryOperation(() => rate_limiter_1.redisRateLimitClient.get(testKey));
            await retryOperation(() => rate_limiter_1.redisRateLimitClient.del(testKey));
        }
        catch (error) {
            logger_1.logger.error(`redisRateLimitClient health check failed: ${error}`);
            redisRateLimitHealth = null;
        }
        const healthStatus = {
            queueRedis: queueRedisHealth === testValue ? "healthy" : "unhealthy",
            redisRateLimitClient: redisRateLimitHealth === testValue ? "healthy" : "unhealthy",
        };
        if (healthStatus.queueRedis === "healthy" &&
            healthStatus.redisRateLimitClient === "healthy") {
            logger_1.logger.info("Both Redis instances are healthy");
            return res.status(200).json({ status: "healthy", details: healthStatus });
        }
        else {
            logger_1.logger.info(`Redis instances health check: ${JSON.stringify(healthStatus)}`);
            // await sendSlackWebhook(
            //   `[REDIS DOWN] Redis instances health check: ${JSON.stringify(
            //     healthStatus
            //   )}`,
            //   true
            // );
            return res
                .status(500)
                .json({ status: "unhealthy", details: healthStatus });
        }
    }
    catch (error) {
        logger_1.logger.error(`Redis health check failed: ${error}`);
        // await sendSlackWebhook(
        //   `[REDIS DOWN] Redis instances health check: ${error.message}`,
        //   true
        // );
        return res
            .status(500)
            .json({ status: "unhealthy", message: error.message });
    }
}
//# sourceMappingURL=redis-health.js.map