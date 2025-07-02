"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cclogController = cclogController;
const redis_1 = require("../../../services/redis");
const supabase_1 = require("../../../services/supabase");
const logger_1 = require("../../../lib/logger");
async function cclog() {
    const logger = logger_1.logger.child({
        module: "cclog",
    });
    let cursor = 0;
    do {
        const result = await redis_1.redisEvictConnection.scan(cursor, "MATCH", "concurrency-limiter:*", "COUNT", 100000);
        cursor = parseInt(result[0], 10);
        const usable = result[1].filter(x => !x.includes("preview_"));
        logger.info("Stepped", { cursor, usable: usable.length });
        if (usable.length > 0) {
            const entries = [];
            for (const x of usable) {
                const at = new Date();
                const concurrency = await redis_1.redisEvictConnection.zrangebyscore(x, Date.now(), Infinity);
                if (concurrency) {
                    entries.push({
                        team_id: x.split(":")[1],
                        concurrency: concurrency.length,
                        created_at: at,
                    });
                }
            }
            try {
                await supabase_1.supabase_service.from("concurrency_log").insert(entries);
            }
            catch (e) {
                logger.error("Error inserting", { error: e });
            }
        }
    } while (cursor != 0);
}
async function cclogController(req, res) {
    try {
        await cclog();
        res.status(200).json({ ok: true });
    }
    catch (e) {
        logger_1.logger.error("Error", { module: "cclog", error: e });
        res.status(500).json({
            message: "Error",
        });
    }
}
//# sourceMappingURL=cclog.js.map