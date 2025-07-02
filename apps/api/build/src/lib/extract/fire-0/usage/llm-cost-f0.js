"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFinalResultCost_F0 = calculateFinalResultCost_F0;
exports.estimateTotalCost_F0 = estimateTotalCost_F0;
exports.estimateCost_F0 = estimateCost_F0;
const logger_1 = require("../../../../lib/logger");
const model_prices_1 = require("../../usage/model-prices");
const tokenPerCharacter = 4;
const baseTokenCost = 300;
function calculateFinalResultCost_F0(data) {
    return Math.floor(JSON.stringify(data).length / tokenPerCharacter + baseTokenCost);
}
function estimateTotalCost_F0(tokenUsage) {
    return tokenUsage.reduce((total, usage) => {
        return total + estimateCost_F0(usage);
    }, 0);
}
function estimateCost_F0(tokenUsage) {
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
//# sourceMappingURL=llm-cost-f0.js.map