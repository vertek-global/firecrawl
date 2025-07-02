"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanBefore24hCompleteJobsController = cleanBefore24hCompleteJobsController;
exports.checkQueuesController = checkQueuesController;
exports.queuesController = queuesController;
exports.autoscalerController = autoscalerController;
const logger_1 = require("../../../lib/logger");
const queue_service_1 = require("../../../services/queue-service");
const alerts_1 = require("../../../services/alerts");
const slack_1 = require("../../../services/alerts/slack");
async function cleanBefore24hCompleteJobsController(req, res) {
    logger_1.logger.info("🐂 Cleaning jobs older than 24h");
    try {
        const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
        const batchSize = 10;
        const numberOfBatches = 9; // Adjust based on your needs
        const completedJobsPromises = [];
        for (let i = 0; i < numberOfBatches; i++) {
            completedJobsPromises.push(scrapeQueue.getJobs(["completed"], i * batchSize, i * batchSize + batchSize, true));
        }
        const completedJobs = (await Promise.all(completedJobsPromises)).flat();
        const before24hJobs = completedJobs.filter((job) => job.finishedOn !== undefined &&
            job.finishedOn < Date.now() - 24 * 60 * 60 * 1000) || [];
        let count = 0;
        if (!before24hJobs) {
            return res.status(200).send(`No jobs to remove.`);
        }
        for (const job of before24hJobs) {
            try {
                await job.remove();
                count++;
            }
            catch (jobError) {
                logger_1.logger.error(`🐂 Failed to remove job with ID ${job.id}: ${jobError}`);
            }
        }
        return res.status(200).send(`Removed ${count} completed jobs.`);
    }
    catch (error) {
        logger_1.logger.error(`🐂 Failed to clean last 24h complete jobs: ${error}`);
        return res.status(500).send("Failed to clean jobs");
    }
}
async function checkQueuesController(req, res) {
    try {
        await (0, alerts_1.checkAlerts)();
        return res.status(200).send("Alerts initialized");
    }
    catch (error) {
        logger_1.logger.debug(`Failed to initialize alerts: ${error}`);
        return res.status(500).send("Failed to initialize alerts");
    }
}
// Use this as a "health check" that way we dont destroy the server
async function queuesController(req, res) {
    try {
        const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
        const [webScraperActive] = await Promise.all([
            scrapeQueue.getActiveCount(),
        ]);
        const noActiveJobs = webScraperActive === 0;
        // 200 if no active jobs, 503 if there are active jobs
        return res.status(noActiveJobs ? 200 : 500).json({
            webScraperActive,
            noActiveJobs,
        });
    }
    catch (error) {
        logger_1.logger.error(error);
        return res.status(500).json({ error: error.message });
    }
}
async function autoscalerController(req, res) {
    try {
        const maxNumberOfMachines = 80;
        const minNumberOfMachines = 20;
        const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
        const [webScraperActive, webScraperWaiting, webScraperPriority] = await Promise.all([
            scrapeQueue.getActiveCount(),
            scrapeQueue.getWaitingCount(),
            scrapeQueue.getPrioritizedCount(),
        ]);
        let waitingAndPriorityCount = webScraperWaiting + webScraperPriority;
        // get number of machines active
        const request = await fetch("https://api.machines.dev/v1/apps/firecrawl-scraper-js/machines", {
            headers: {
                Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
            },
        });
        const machines = await request.json();
        // Only worker machines
        const activeMachines = machines.filter((machine) => (machine.state === "started" ||
            machine.state === "starting" ||
            machine.state === "replacing") &&
            machine.config.env["FLY_PROCESS_GROUP"] === "worker").length;
        let targetMachineCount = activeMachines;
        const baseScaleUp = 10;
        // Slow scale down
        const baseScaleDown = 2;
        // Scale up logic
        if (webScraperActive > 9000 || waitingAndPriorityCount > 2000) {
            targetMachineCount = Math.min(maxNumberOfMachines, activeMachines + baseScaleUp * 3);
        }
        else if (webScraperActive > 5000 || waitingAndPriorityCount > 1000) {
            targetMachineCount = Math.min(maxNumberOfMachines, activeMachines + baseScaleUp * 2);
        }
        else if (webScraperActive > 1000 || waitingAndPriorityCount > 500) {
            targetMachineCount = Math.min(maxNumberOfMachines, activeMachines + baseScaleUp);
        }
        // Scale down logic
        if (webScraperActive < 100 && waitingAndPriorityCount < 50) {
            targetMachineCount = Math.max(minNumberOfMachines, activeMachines - baseScaleDown * 3);
        }
        else if (webScraperActive < 500 && waitingAndPriorityCount < 200) {
            targetMachineCount = Math.max(minNumberOfMachines, activeMachines - baseScaleDown * 2);
        }
        else if (webScraperActive < 1000 && waitingAndPriorityCount < 500) {
            targetMachineCount = Math.max(minNumberOfMachines, activeMachines - baseScaleDown);
        }
        if (targetMachineCount !== activeMachines) {
            logger_1.logger.info(`🐂 Scaling from ${activeMachines} to ${targetMachineCount} - ${webScraperActive} active, ${webScraperWaiting} waiting`);
            if (targetMachineCount > activeMachines) {
                (0, slack_1.sendSlackWebhook)(`🐂 Scaling from ${activeMachines} to ${targetMachineCount} - ${webScraperActive} active, ${webScraperWaiting} waiting - Current DateTime: ${new Date().toISOString()}`, false, process.env.SLACK_AUTOSCALER ?? "");
            }
            else {
                (0, slack_1.sendSlackWebhook)(`🐂 Scaling from ${activeMachines} to ${targetMachineCount} - ${webScraperActive} active, ${webScraperWaiting} waiting - Current DateTime: ${new Date().toISOString()}`, false, process.env.SLACK_AUTOSCALER ?? "");
            }
            return res.status(200).json({
                mode: "scale-descale",
                count: targetMachineCount,
            });
        }
        return res.status(200).json({
            mode: "normal",
            count: activeMachines,
        });
    }
    catch (error) {
        logger_1.logger.error(error);
        return res.status(500).send("Failed to initialize autoscaler");
    }
}
//# sourceMappingURL=queue.js.map