"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchExtractPromise = batchExtractPromise;
const build_document_1 = require("../build-document");
const build_prompts_1 = require("../build-prompts");
const generic_ai_1 = require("../../generic-ai");
const extraction_service_1 = require("../extraction-service");
const extractSmartScrape_1 = require("../../../scraper/scrapeURL/lib/extractSmartScrape");
/**
 * Batch extract information from a list of URLs using a multi-entity schema.
 * @param multiEntitySchema - The schema for the multi-entity extraction
 * @param links - The URLs to extract information from
 * @param prompt - The prompt for the extraction
 * @param systemPrompt - The system prompt for the extraction
 * @param doc - The document to extract information from
 * @returns The completion promise
 */
async function batchExtractPromise(options, logger) {
    const { multiEntitySchema, links, prompt, systemPrompt, doc, useAgent, extractId, sessionId } = options;
    const generationOptions = {
        logger: logger.child({
            method: "extractService/generateCompletions",
        }),
        options: {
            mode: "llm",
            systemPrompt: (0, build_prompts_1.buildBatchExtractSystemPrompt)(systemPrompt, multiEntitySchema, links),
            prompt: (0, build_prompts_1.buildBatchExtractPrompt)(prompt),
            schema: multiEntitySchema,
        },
        markdown: (0, build_document_1.buildDocument)(doc),
        isExtractEndpoint: true,
        model: (0, generic_ai_1.getModel)("gemini-2.5-pro", "vertex"),
        retryModel: (0, generic_ai_1.getModel)("gemini-2.5-pro", "google"),
        costTrackingOptions: {
            costTracking: options.costTracking,
            metadata: {
                module: "extract",
                method: "batchExtractPromise",
            },
        },
    };
    let extractedDataArray = [];
    let warning;
    let smCost = 0, oCost = 0, smCallCount = 0, oCallCount = 0;
    try {
        const { extractedDataArray: e, warning: w, } = await (0, extractSmartScrape_1.extractData)({
            extractOptions: generationOptions,
            urls: [doc.metadata.sourceURL || doc.metadata.url || ""],
            useAgent,
            extractId,
            sessionId,
        });
        extractedDataArray = e;
        warning = w;
    }
    catch (error) {
        if (error instanceof extraction_service_1.CostLimitExceededError) {
            throw error;
        }
        logger.error("extractData failed", { error });
    }
    // await fs.writeFile(
    //   `logs/extractedDataArray-${crypto.randomUUID()}.json`,
    //   JSON.stringify(extractedDataArray, null, 2),
    // );
    // TODO: fix this
    return {
        extract: extractedDataArray,
        numTokens: 0,
        totalUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            model: "gemini-2.0-flash",
        },
        warning: warning,
        sources: [doc.metadata.url || doc.metadata.sourceURL || ""],
        smartScrapeCost: smCost,
        otherCost: oCost,
        smartScrapeCallCount: smCallCount,
        otherCallCount: oCallCount,
    };
}
//# sourceMappingURL=batchExtract.js.map