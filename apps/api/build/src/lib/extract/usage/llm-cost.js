"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateThinkingCost = calculateThinkingCost;
exports.calculateFinalResultCost = calculateFinalResultCost;
exports.estimateTotalCost = estimateTotalCost;
exports.estimateCost = estimateCost;
const logger_1 = require("../../../lib/logger");
const model_prices_1 = require("./model-prices");
const tokenPerCharacter = 0.5;
const baseTokenCost = 300;
function calculateThinkingCost(costTracking) {
    return Math.ceil(costTracking.toJSON().totalCost * 20000);
}
function calculateFinalResultCost(data) {
    return Math.floor(JSON.stringify(data).length / tokenPerCharacter + baseTokenCost);
}
function estimateTotalCost(tokenUsage) {
    return tokenUsage.reduce((total, usage) => {
        return total + estimateCost(usage);
    }, 0);
}
function estimateCost(tokenUsage) {
    let totalCost = 0;
    try {
        let model = tokenUsage.model ?? (process.env.MODEL_NAME || "gpt-4o-mini");
        const pricing = model_prices_1.modelPrices[model];
        if (!pricing) {
            logger_1.logger.error(`No pricing information found for model: ${model}`);
            return 0;
        }
        if (pricing.mode !== "chat") {
            logger_1.logger.error(`Model ${model} is not a chat model`);
            return 0;
        }
        // Add per-request cost if applicable (Only Perplexity supports this)
        if (pricing.input_cost_per_request) {
            totalCost += pricing.input_cost_per_request;
        }
        // Add token-based costs
        if (pricing.input_cost_per_token) {
            totalCost += tokenUsage.promptTokens * pricing.input_cost_per_token;
        }
        if (pricing.output_cost_per_token) {
            totalCost += tokenUsage.completionTokens * pricing.output_cost_per_token;
        }
        return Number(totalCost.toFixed(7));
    }
    catch (error) {
        logger_1.logger.error(`Error estimating cost: ${error}`);
        return totalCost;
    }
}
//# sourceMappingURL=llm-cost.js.map