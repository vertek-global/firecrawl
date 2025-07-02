"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.concurrencyCheckController = concurrencyCheckController;
const redis_1 = require("../../../src/services/redis");
// Basically just middleware and error wrapping
async function concurrencyCheckController(req, res) {
    const concurrencyLimiterKey = "concurrency-limiter:" + req.auth.team_id;
    const now = Date.now();
    const activeJobsOfTeam = await redis_1.redisEvictConnection.zrangebyscore(concurrencyLimiterKey, now, Infinity);
    return res.status(200).json({
        success: true,
        concurrency: activeJobsOfTeam.length,
        maxConcurrency: req.acuc.concurrency,
    });
}
//# sourceMappingURL=concurrency-check.js.map