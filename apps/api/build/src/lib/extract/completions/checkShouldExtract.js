"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkShouldExtract = checkShouldExtract;
const logger_1 = require("../../../lib/logger");
const build_document_1 = require("../build-document");
const llmExtract_1 = require("../../../scraper/scrapeURL/transformers/llmExtract");
const build_prompts_1 = require("../build-prompts");
const generic_ai_1 = require("../../../lib/generic-ai");
async function checkShouldExtract(prompt, multiEntitySchema, doc, costTracking) {
    const shouldExtractCheck = await (0, llmExtract_1.generateCompletions)({
        logger: logger_1.logger.child({ method: "extractService/checkShouldExtract" }),
        options: {
            mode: "llm",
            systemPrompt: (0, build_prompts_1.buildShouldExtractSystemPrompt)(),
            prompt: (0, build_prompts_1.buildShouldExtractUserPrompt)(prompt, multiEntitySchema),
            schema: {
                type: "object",
                properties: {
                    extract: {
                        type: "boolean",
                    },
                },
                required: ["extract"],
            },
        },
        markdown: (0, build_document_1.buildDocument)(doc),
        isExtractEndpoint: true,
        model: (0, generic_ai_1.getModel)("gpt-4o-mini", "openai"),
        costTrackingOptions: {
            costTracking,
            metadata: {
                module: "extract",
                method: "checkShouldExtract",
            },
        },
    });
    return {
        tokenUsage: shouldExtractCheck.totalUsage,
        extract: shouldExtractCheck.extract["extract"],
    };
}
//# sourceMappingURL=checkShouldExtract.js.map