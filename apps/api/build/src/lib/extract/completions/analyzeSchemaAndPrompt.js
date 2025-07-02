"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeSchemaAndPrompt = analyzeSchemaAndPrompt;
const llmExtract_1 = require("../../../scraper/scrapeURL/transformers/llmExtract");
const zod_1 = require("zod");
const build_prompts_1 = require("../build-prompts");
const generic_ai_1 = require("../../../lib/generic-ai");
async function analyzeSchemaAndPrompt(urls, schema, prompt, logger, costTracking) {
    if (!schema) {
        const genRes = await (0, llmExtract_1.generateSchemaFromPrompt)(prompt, logger, costTracking);
        schema = genRes.extract;
    }
    const schemaString = JSON.stringify(schema);
    const model = (0, generic_ai_1.getModel)("gpt-4o", "openai");
    const checkSchema = zod_1.z
        .object({
        isMultiEntity: zod_1.z.boolean(),
        multiEntityKeys: zod_1.z.array(zod_1.z.string()).optional().default([]),
        reasoning: zod_1.z.string(),
        keyIndicators: zod_1.z.array(zod_1.z.string()),
    })
        .refine((x) => !x.isMultiEntity || x.multiEntityKeys.length > 0, "isMultiEntity was true, but no multiEntityKeys");
    try {
        const { extract: result, totalUsage } = await (0, llmExtract_1.generateCompletions)({
            logger,
            options: {
                mode: "llm",
                schema: checkSchema,
                prompt: (0, build_prompts_1.buildAnalyzeSchemaUserPrompt)(schemaString, prompt, urls),
                systemPrompt: (0, build_prompts_1.buildAnalyzeSchemaPrompt)(),
            },
            markdown: "",
            model,
            costTrackingOptions: {
                costTracking,
                metadata: {
                    module: "extract",
                    method: "analyzeSchemaAndPrompt",
                },
            },
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
        logger.warn("(analyzeSchemaAndPrompt) Error parsing schema analysis", {
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
//# sourceMappingURL=analyzeSchemaAndPrompt.js.map