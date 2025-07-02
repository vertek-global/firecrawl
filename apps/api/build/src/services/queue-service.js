"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingQueueName = exports.deepResearchQueueName = exports.generateLlmsTxtQueueName = exports.indexQueueName = exports.loggingQueueName = exports.extractQueueName = exports.scrapeQueueName = exports.redisConnection = void 0;
exports.getScrapeQueue = getScrapeQueue;
exports.getExtractQueue = getExtractQueue;
exports.getGenerateLlmsTxtQueue = getGenerateLlmsTxtQueue;
exports.getDeepResearchQueue = getDeepResearchQueue;
exports.getBillingQueue = getBillingQueue;
const bullmq_1 = require("bullmq");
const logger_1 = require("../lib/logger");
const ioredis_1 = __importDefault(require("ioredis"));
let scrapeQueue;
let extractQueue;
let loggingQueue;
let indexQueue;
let deepResearchQueue;
let generateLlmsTxtQueue;
let billingQueue;
exports.redisConnection = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
exports.scrapeQueueName = "{scrapeQueue}";
exports.extractQueueName = "{extractQueue}";
exports.loggingQueueName = "{loggingQueue}";
exports.indexQueueName = "{indexQueue}";
exports.generateLlmsTxtQueueName = "{generateLlmsTxtQueue}";
exports.deepResearchQueueName = "{deepResearchQueue}";
exports.billingQueueName = "{billingQueue}";
function getScrapeQueue() {
    if (!scrapeQueue) {
        scrapeQueue = new bullmq_1.Queue(exports.scrapeQueueName, {
            connection: exports.redisConnection,
            defaultJobOptions: {
                removeOnComplete: {
                    age: 3600, // 1 hour
                },
                removeOnFail: {
                    age: 3600, // 1 hour
                },
            },
        });
        logger_1.logger.info("Web scraper queue created");
    }
    return scrapeQueue;
}
function getExtractQueue() {
    if (!extractQueue) {
        extractQueue = new bullmq_1.Queue(exports.extractQueueName, {
            connection: exports.redisConnection,
            defaultJobOptions: {
                removeOnComplete: {
                    age: 90000, // 25 hours
                },
                removeOnFail: {
                    age: 90000, // 25 hours
                },
            },
        });
        logger_1.logger.info("Extraction queue created");
    }
    return extractQueue;
}
function getGenerateLlmsTxtQueue() {
    if (!generateLlmsTxtQueue) {
        generateLlmsTxtQueue = new bullmq_1.Queue(exports.generateLlmsTxtQueueName, {
            connection: exports.redisConnection,
            defaultJobOptions: {
                removeOnComplete: {
                    age: 90000, // 25 hours
                },
                removeOnFail: {
                    age: 90000, // 25 hours
                },
            },
        });
        logger_1.logger.info("LLMs TXT generation queue created");
    }
    return generateLlmsTxtQueue;
}
function getDeepResearchQueue() {
    if (!deepResearchQueue) {
        deepResearchQueue = new bullmq_1.Queue(exports.deepResearchQueueName, {
            connection: exports.redisConnection,
            defaultJobOptions: {
                removeOnComplete: {
                    age: 90000, // 25 hours
                },
                removeOnFail: {
                    age: 90000, // 25 hours
                },
            },
        });
        logger_1.logger.info("Deep research queue created");
    }
    return deepResearchQueue;
}
function getBillingQueue() {
    if (!billingQueue) {
        billingQueue = new bullmq_1.Queue(exports.billingQueueName, {
            connection: exports.redisConnection,
            defaultJobOptions: {
                removeOnComplete: {
                    age: 3600, // 1 hour
                },
                removeOnFail: {
                    age: 3600, // 1 hour
                },
            },
        });
        logger_1.logger.info("Billing queue created");
    }
    return billingQueue;
}
//# sourceMappingURL=queue-service.js.map