"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSlackWebhook = sendSlackWebhook;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../../src/lib/logger");
async function sendSlackWebhook(message, alertEveryone = false, webhookUrl = process.env.SLACK_WEBHOOK_URL ?? "") {
    const messagePrefix = alertEveryone ? "<!channel> " : "";
    const payload = {
        text: `${messagePrefix} ${message}`,
    };
    try {
        const response = await axios_1.default.post(webhookUrl, payload, {
            headers: {
                "Content-Type": "application/json",
            },
        });
        logger_1.logger.info("Webhook sent successfully:", response.data);
    }
    catch (error) {
        logger_1.logger.debug(`Error sending webhook: ${error}`);
    }
}
//# sourceMappingURL=slack.js.map