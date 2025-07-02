"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = __importDefault(require("express"));
const redis_health_1 = require("../controllers/v0/admin/redis-health");
const queue_1 = require("../controllers/v0/admin/queue");
const v1_1 = require("./v1");
const acuc_cache_clear_1 = require("../controllers/v0/admin/acuc-cache-clear");
const check_fire_engine_1 = require("../controllers/v0/admin/check-fire-engine");
const cclog_1 = require("../controllers/v0/admin/cclog");
const index_queue_prometheus_1 = require("../controllers/v0/admin/index-queue-prometheus");
const zdrcleaner_1 = require("../controllers/v0/admin/zdrcleaner");
exports.adminRouter = express_1.default.Router();
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/redis-health`, redis_health_1.redisHealthController);
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/clean-before-24h-complete-jobs`, queue_1.cleanBefore24hCompleteJobsController);
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/check-queues`, queue_1.checkQueuesController);
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/queues`, queue_1.queuesController);
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/autoscaler`, queue_1.autoscalerController);
exports.adminRouter.post(`/admin/${process.env.BULL_AUTH_KEY}/acuc-cache-clear`, (0, v1_1.wrap)(acuc_cache_clear_1.acucCacheClearController));
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/feng-check`, (0, v1_1.wrap)(check_fire_engine_1.checkFireEngine));
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/cclog`, (0, v1_1.wrap)(cclog_1.cclogController));
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/zdrcleaner`, (0, v1_1.wrap)(zdrcleaner_1.zdrcleanerController));
exports.adminRouter.get(`/admin/${process.env.BULL_AUTH_KEY}/index-queue-prometheus`, (0, v1_1.wrap)(index_queue_prometheus_1.indexQueuePrometheus));
//# sourceMappingURL=admin.js.map