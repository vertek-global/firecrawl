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
exports.callWebhook = void 0;
exports.getWebhookInsertQueueLength = getWebhookInsertQueueLength;
exports.processWebhookInsertJobs = processWebhookInsertJobs;
const axios_1 = __importStar(require("axios"));
const logger_1 = require("../lib/logger");
const supabase_1 = require("./supabase");
const dotenv_1 = require("dotenv");
const types_1 = require("../controllers/v1/types");
const redis_1 = require("./redis");
(0, dotenv_1.configDotenv)();
const WEBHOOK_INSERT_QUEUE_KEY = "webhook-insert-queue";
const WEBHOOK_INSERT_BATCH_SIZE = 1000;
async function addWebhookInsertJob(data) {
    await redis_1.redisEvictConnection.rpush(WEBHOOK_INSERT_QUEUE_KEY, JSON.stringify(data));
}
async function getWebhookInsertQueueLength() {
    return await redis_1.redisEvictConnection.llen(WEBHOOK_INSERT_QUEUE_KEY) ?? 0;
}
async function getWebhookInsertJobs() {
    const jobs = (await redis_1.redisEvictConnection.lpop(WEBHOOK_INSERT_QUEUE_KEY, WEBHOOK_INSERT_BATCH_SIZE)) ?? [];
    return jobs.map(x => JSON.parse(x));
}
async function processWebhookInsertJobs() {
    const jobs = await getWebhookInsertJobs();
    if (jobs.length === 0) {
        return;
    }
    logger_1.logger.info(`Webhook inserter found jobs to insert`, { jobCount: jobs.length });
    try {
        await supabase_1.supabase_service.from("webhook_logs").insert(jobs);
        logger_1.logger.info(`Webhook inserter inserted jobs`, { jobCount: jobs.length });
    }
    catch (error) {
        logger_1.logger.error(`Webhook inserter failed to insert jobs`, { error, jobCount: jobs.length });
    }
}
async function logWebhook(data) {
    try {
        await addWebhookInsertJob({
            success: data.success,
            error: data.error ?? null,
            team_id: data.teamId,
            crawl_id: data.crawlId,
            scrape_id: data.scrapeId ?? null,
            url: data.url,
            status_code: data.statusCode ?? null,
            event: data.event,
        });
    }
    catch (error) {
        logger_1.logger.error("Error logging webhook", { error, crawlId: data.crawlId, scrapeId: data.scrapeId, teamId: data.teamId, team_id: data.teamId, module: "webhook", method: "logWebhook" });
    }
}
const callWebhook = async ({ teamId, crawlId, scrapeId, data, webhook, v1, eventType, awaitWebhook = false, }) => {
    const logger = logger_1.logger.child({
        module: "webhook",
        method: "callWebhook",
        teamId, team_id: teamId,
        crawlId,
        scrapeId,
        eventType,
        awaitWebhook,
        webhook,
        isV1: v1,
    });
    if (webhook) {
        let subType = eventType.split(".")[1];
        if (!webhook.events.includes(subType)) {
            logger.debug("Webhook event type not in specified events", {
                subType,
                webhook,
            });
            return false;
        }
    }
    try {
        const selfHostedUrl = process.env.SELF_HOSTED_WEBHOOK_URL?.replace("{{JOB_ID}}", crawlId);
        const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === "true";
        let webhookUrl = webhook ??
            (selfHostedUrl ? types_1.webhookSchema.parse({ url: selfHostedUrl }) : undefined);
        // Only fetch the webhook URL from the database if the self-hosted webhook URL and specified webhook are not set
        // and the USE_DB_AUTHENTICATION environment variable is set to true
        if (!webhookUrl && useDbAuthentication) {
            const { data: webhooksData, error } = await supabase_1.supabase_rr_service
                .from("webhooks")
                .select("url")
                .eq("team_id", teamId)
                .limit(1);
            if (error) {
                logger.error(`Error fetching webhook URL for team`, {
                    error,
                });
                return null;
            }
            if (!webhooksData || webhooksData.length === 0) {
                return null;
            }
            webhookUrl = webhooksData[0].url;
        }
        logger.debug("Calling webhook...", {
            webhookUrl,
        });
        if (!webhookUrl) {
            return null;
        }
        let dataToSend = [];
        if (data &&
            data.result &&
            data.result.links &&
            data.result.links.length !== 0) {
            for (let i = 0; i < data.result.links.length; i++) {
                if (v1) {
                    dataToSend.push(data.result.links[i].content);
                }
                else {
                    dataToSend.push({
                        content: data.result.links[i].content.content,
                        markdown: data.result.links[i].content.markdown,
                        metadata: data.result.links[i].content.metadata,
                    });
                }
            }
        }
        if (awaitWebhook) {
            try {
                const res = await axios_1.default.post(webhookUrl.url, {
                    success: !v1
                        ? data.success
                        : eventType === "crawl.page"
                            ? data.success
                            : true,
                    type: eventType,
                    [v1 ? "id" : "jobId"]: crawlId,
                    data: dataToSend,
                    error: !v1
                        ? data?.error || undefined
                        : eventType === "crawl.page"
                            ? data?.error || undefined
                            : undefined,
                    metadata: webhookUrl.metadata || undefined,
                }, {
                    headers: {
                        "Content-Type": "application/json",
                        ...webhookUrl.headers,
                    },
                    timeout: v1 ? 10000 : 30000, // 10 seconds timeout (v1)
                });
                logWebhook({
                    success: res.status >= 200 && res.status < 300,
                    teamId,
                    crawlId,
                    scrapeId,
                    url: webhookUrl.url,
                    event: eventType,
                    statusCode: res.status,
                });
            }
            catch (error) {
                logger.error(`Failed to send webhook`, {
                    error,
                });
                logWebhook({
                    success: false,
                    teamId,
                    crawlId,
                    scrapeId,
                    url: webhookUrl.url,
                    event: eventType,
                    error: error instanceof Error ? error.message : (typeof error === "string" ? error : undefined),
                    statusCode: error instanceof axios_1.AxiosError ? error.response?.status : undefined,
                });
            }
        }
        else {
            axios_1.default
                .post(webhookUrl.url, {
                success: !v1
                    ? data.success
                    : eventType === "crawl.page"
                        ? data.success
                        : true,
                type: eventType,
                [v1 ? "id" : "jobId"]: crawlId,
                data: dataToSend,
                error: !v1
                    ? data?.error || undefined
                    : eventType === "crawl.page"
                        ? data?.error || undefined
                        : undefined,
                metadata: webhookUrl.metadata || undefined,
            }, {
                headers: {
                    "Content-Type": "application/json",
                    ...webhookUrl.headers,
                },
            })
                .then((res) => {
                logWebhook({
                    success: res.status >= 200 && res.status < 300,
                    teamId,
                    crawlId,
                    scrapeId,
                    url: webhookUrl.url,
                    event: eventType,
                    statusCode: res.status,
                });
            })
                .catch((error) => {
                logger.error(`Failed to send webhook`, {
                    error,
                });
                logWebhook({
                    success: false,
                    teamId,
                    crawlId,
                    scrapeId,
                    url: webhookUrl.url,
                    event: eventType,
                    error: error instanceof Error ? error.message : (typeof error === "string" ? error : undefined),
                    statusCode: error instanceof axios_1.AxiosError ? error.response?.status : undefined,
                });
            });
        }
    }
    catch (error) {
        logger.debug(`Error sending webhook`, {
            error,
        });
    }
};
exports.callWebhook = callWebhook;
//# sourceMappingURL=webhook.js.map