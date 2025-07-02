"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchExtractPromise_F0 = batchExtractPromise_F0;
const logger_1 = require("../../../../lib/logger");
const llmExtract_f0_1 = require("../llmExtract-f0");
const build_prompts_f0_1 = require("../build-prompts-f0");
const build_document_f0_1 = require("../build-document-f0");
/**
 * Batch extract information from a list of URLs using a multi-entity schema.
 * @param multiEntitySchema - The schema for the multi-entity extraction
 * @param links - The URLs to extract information from
 * @param prompt - The prompt for the extraction
 * @param systemPrompt - The system prompt for the extraction
 * @param doc - The document to extract information from
 * @returns The completion promise
 */
async function batchExtractPromise_F0(multiEntitySchema, links, prompt, systemPrompt, doc) {
    const completion = await (0, llmExtract_f0_1.generateCompletions_F0)({
        logger: logger_1.logger.child({
            method: "extractService/generateCompletions",
        }),
        options: {
            mode: "llm",
            systemPrompt: (0, build_prompts_f0_1.buildBatchExtractSystemPrompt_F0)(systemPrompt, multiEntitySchema, links),
            prompt: (0, build_prompts_f0_1.buildBatchExtractPrompt_F0)(prompt),
            schema: multiEntitySchema,
        },
        markdown: (0, build_document_f0_1.buildDocument_F0)(doc),
        isExtractEndpoint: true
    });
    return {
        extract: completion.extract,
        numTokens: completion.numTokens,
        totalUsage: completion.totalUsage,
        sources: [doc.metadata.url || doc.metadata.sourceURL || ""]
    };
}
//# sourceMappingURL=batchExtract-f0.js.map