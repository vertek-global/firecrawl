"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlCancelController = crawlCancelController;
const auth_1 = require("../auth");
const types_1 = require("../../../src/types");
const supabase_1 = require("../../../src/services/supabase");
const logger_1 = require("../../../src/lib/logger");
const crawl_redis_1 = require("../../../src/lib/crawl-redis");
const Sentry = __importStar(require("@sentry/node"));
const dotenv_1 = require("dotenv");
const redis_1 = require("../../../src/services/redis");
(0, dotenv_1.configDotenv)();
async function crawlCancelController(req, res) {
    try {
        const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === "true";
        const auth = await (0, auth_1.authenticateUser)(req, res, types_1.RateLimiterMode.CrawlStatus);
        if (!auth.success) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { team_id } = auth;
        if (auth.chunk?.flags?.forceZDR) {
            return res.status(400).json({ error: "Your team has zero data retention enabled. This is not supported on the v0 API. Please update your code to use the v1 API." });
        }
        redis_1.redisEvictConnection.sadd("teams_using_v0", team_id)
            .catch(error => logger_1.logger.error("Failed to add team to teams_using_v0", { error, team_id }));
        const sc = await (0, crawl_redis_1.getCrawl)(req.params.jobId);
        if (!sc) {
            return res.status(404).json({ error: "Job not found" });
        }
        // check if the job belongs to the team
        if (useDbAuthentication) {
            const { data, error: supaError } = await supabase_1.supabase_service
                .from("bulljobs_teams")
                .select("*")
                .eq("job_id", req.params.jobId)
                .eq("team_id", team_id);
            if (supaError) {
                return res.status(500).json({ error: supaError.message });
            }
            if (data.length === 0) {
                return res.status(403).json({ error: "Unauthorized" });
            }
        }
        try {
            sc.cancelled = true;
            await (0, crawl_redis_1.saveCrawl)(req.params.jobId, sc);
        }
        catch (error) {
            logger_1.logger.error(error);
        }
        res.json({
            status: "cancelled",
        });
    }
    catch (error) {
        Sentry.captureException(error);
        logger_1.logger.error(error);
        return res.status(500).json({ error: error.message });
    }
}
//# sourceMappingURL=crawl-cancel.js.map