"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSchemaAndPrompt_F0 = analyzeSchemaAndPrompt_F0;
const zod_1 = require("zod");
const build_prompts_1 = require("../../build-prompts");
const logger_1 = require("../../../logger");
const generic_ai_1 = require("../../../generic-ai");
const llmExtract_f0_1 = require("../llmExtract-f0");
async function analyzeSchemaAndPrompt_F0(urls, schema, prompt) {
    if (!schema) {
        schema = await (0, llmExtract_f0_1.generateSchemaFromPrompt_F0)(prompt);
    }
    const schemaString = JSON.stringify(schema);
    const model = (0, generic_ai_1.getModel)("gpt-4o");
    const checkSchema = zod_1.z
        .object({
        isMultiEntity: zod_1.z.boolean(),
        multiEntityKeys: zod_1.z.array(zod_1.z.string()).optional().default([]),
        reasoning: zod_1.z.string(),
        keyIndicators: zod_1.z.array(zod_1.z.string()),
    })
        .refine((x) => !x.isMultiEntity || x.multiEntityKeys.length > 0, "isMultiEntity was true, but no multiEntityKeys");
    try {
        const { extract: result, totalUsage } = await (0, llmExtract_f0_1.generateCompletions_F0)({
            logger: logger_1.logger,
            options: {
                mode: "llm",
                schema: checkSchema,
                prompt: (0, build_prompts_1.buildAnalyzeSchemaUserPrompt)(schemaString, prompt, urls),
                systemPrompt: (0, build_prompts_1.buildAnalyzeSchemaPrompt)(),
            },
            markdown: "",
            model,
        });
        const { isMultiEntity, multiEntityKeys, reasoning, keyIndicators } = checkSchema.parse(result);
        return {
            isMultiEntity,
            multiEntityKeys,
            reasoning,
            keyIndicators,
            tokenUsage: totalUsage,
        };
    }
    catch (e) {
        logger_1.logger.warn("(analyzeSchemaAndPrompt) Error parsing schema analysis", {
            error: e,
        });
    }
    return {
        isMultiEntity: false,
        multiEntityKeys: [],
        reasoning: "",
        keyIndicators: [],
        tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            model: model.modelId,
        },
    };
}
//# sourceMappingURL=analyzeSchemaAndPrompt-f0.js.map