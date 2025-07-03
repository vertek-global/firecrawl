import { Queue } from "bullmq";
import { logger } from "../lib/logger";
import IORedis from "ioredis";

export type QueueFunction = () => Queue<any, any, string, any, any, string>;

let scrapeQueue: Queue;
let extractQueue: Queue;
let loggingQueue: Queue;
let indexQueue: Queue;
let deepResearchQueue: Queue;
let generateLlmsTxtQueue: Queue;
let billingQueue: Queue;

// --- START OF RAILWAY DEBUG ---
console.log("!!! RAILWAY DEBUG: Reading process.env.REDIS_URL. The value is: ", process.env.REDIS_URL, "!!!");
// --- END OF RAILWAY DEBUG ---

export const redisConnection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const scrapeQueueName = "{scrapeQueue}";
export const extractQueueName = "{extractQueue}";
export const loggingQueueName = "{loggingQueue}";
export const indexQueueName = "{indexQueue}";
export const generateLlmsTxtQueueName = "{generateLlmsTxtQueue}";
export const deepResearchQueueName = "{deepResearchQueue}";
export const billingQueueName = "{billingQueue}";

export function getScrapeQueue() {
  if (!scrapeQueue) {
    scrapeQueue = new Queue(scrapeQueueName, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // 1 hour
        },
        removeOnFail: {
          age: 3600, // 1 hour
        },
      },
    });
    logger.info("Web scraper queue created");
  }
  return scrapeQueue;
}

export function getExtractQueue() {
  if (!extractQueue) {
    extractQueue = new Queue(extractQueueName, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 90000, // 25 hours
        },
        removeOnFail: {
          age: 90000, // 25 hours
        },
      },
    });
    logger.info("Extraction queue created");
  }
  return extractQueue;
}

export function getGenerateLlmsTxtQueue() {
  if (!generateLlmsTxtQueue) {
    generateLlmsTxtQueue = new Queue(generateLlmsTxtQueueName, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 90000, // 25 hours
        },
        removeOnFail: {
          age: 90000, // 25 hours
        },
      },
    });
    logger.info("LLMs TXT generation queue created");
  }
  return generateLlmsTxtQueue;
}

export function getDeepResearchQueue() {
  if (!deepResearchQueue) {
    deepResearchQueue = new Queue(deepResearchQueueName, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 90000, // 25 hours
        },
        removeOnFail: {
          age: 90000, // 25 hours
        },
      },
    });
    logger.info("Deep research queue created");
  }
  return deepResearchQueue;
}

export function getBillingQueue() {
  if (!billingQueue) {
    billingQueue = new Queue(billingQueueName, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // 1 hour
        },
        removeOnFail: {
          age: 3600, // 1 hour
        },
      },
    });
    logger.info("Billing queue created");
  }
  return billingQueue;
}