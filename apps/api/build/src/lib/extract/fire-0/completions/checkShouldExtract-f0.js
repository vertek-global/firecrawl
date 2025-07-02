"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkShouldExtract_F0 = checkShouldExtract_F0;
const logger_1 = require("../../../../lib/logger");
const build_document_1 = require("../../build-document");
const llmExtract_f0_1 = require("../llmExtract-f0");
const build_prompts_f0_1 = require("../build-prompts-f0");
const generic_ai_1 = require("../../../../lib/generic-ai");
async function checkShouldExtract_F0(prompt, multiEntitySchema, doc) {
    const shouldExtractCheck = await (0, llmExtract_f0_1.generateCompletions_F0)({
        logger: logger_1.logger.child({ method: "extractService/checkShouldExtract" }),
        options: {
            mode: "llm",
            systemPrompt: (0, build_prompts_f0_1.buildShouldExtractSystemPrompt_F0)(),
            prompt: (0, build_prompts_f0_1.buildShouldExtractUserPrompt_F0)(prompt, multiEntitySchema),
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
        model: (0, generic_ai_1.getModel)("gpt-4o-mini"),
    });
    return {
        tokenUsage: shouldExtractCheck.totalUsage,
        extract: shouldExtractCheck.extract["extract"],
    };
}
//# sourceMappingURL=checkShouldExtract-f0.js.map