"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAlerts = checkAlerts;
const logger_1 = require("../../../src/lib/logger");
const queue_service_1 = require("../queue-service");
const slack_1 = require("./slack");
async function checkAlerts() {
    try {
        if (process.env.SLACK_WEBHOOK_URL &&
            process.env.ENV === "production" &&
            process.env.ALERT_NUM_ACTIVE_JOBS &&
            process.env.ALERT_NUM_WAITING_JOBS) {
            logger_1.logger.info("Initializing alerts");
            const checkActiveJobs = async () => {
                try {
                    const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
                    const activeJobs = await scrapeQueue.getActiveCount();
                    if (activeJobs > Number(process.env.ALERT_NUM_ACTIVE_JOBS)) {
                        logger_1.logger.warn(`Alert: Number of active jobs is over ${process.env.ALERT_NUM_ACTIVE_JOBS}. Current active jobs: ${activeJobs}.`);
                        (0, slack_1.sendSlackWebhook)(`Alert: Number of active jobs is over ${process.env.ALERT_NUM_ACTIVE_JOBS}. Current active jobs: ${activeJobs}`, true);
                    }
                    else {
                        logger_1.logger.info(`Number of active jobs is under ${process.env.ALERT_NUM_ACTIVE_JOBS}. Current active jobs: ${activeJobs}`);
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Failed to check active jobs: ${error}`);
                }
            };
            const checkWaitingQueue = async () => {
                const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
                const waitingJobs = await scrapeQueue.getWaitingCount();
                if (waitingJobs > Number(process.env.ALERT_NUM_WAITING_JOBS)) {
                    logger_1.logger.warn(`Alert: Number of waiting jobs is over ${process.env.ALERT_NUM_WAITING_JOBS}. Current waiting jobs: ${waitingJobs}.`);
                    (0, slack_1.sendSlackWebhook)(`Alert: Number of waiting jobs is over ${process.env.ALERT_NUM_WAITING_JOBS}. Current waiting jobs: ${waitingJobs}. Scale up the number of workers with fly scale count worker=20`, true);
                }
            };
            const checkAll = async () => {
                await checkActiveJobs();
                await checkWaitingQueue();
            };
            await checkAll();
            // setInterval(checkAll, 10000); // Run every
        }
    }
    catch (error) {
        logger_1.logger.error(`Failed to initialize alerts: ${error}`);
    }
}
//# sourceMappingURL=index.js.map