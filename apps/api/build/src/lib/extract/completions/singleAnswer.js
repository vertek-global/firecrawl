"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleAnswerCompletion = singleAnswerCompletion;
const logger_1 = require("../../../lib/logger");
const build_document_1 = require("../build-document");
const generic_ai_1 = require("../../../lib/generic-ai");
const extractSmartScrape_1 = require("../../../scraper/scrapeURL/lib/extractSmartScrape");
async function singleAnswerCompletion({ singleAnswerDocs, rSchema, links, prompt, systemPrompt, useAgent, extractId, sessionId, costTracking, }) {
    const docsPrompt = `Today is: ` + new Date().toISOString() + `.\n` + prompt;
    const generationOptions = {
        logger: logger_1.logger.child({
            module: "extract",
            method: "generateCompletions",
            extractId,
        }),
        options: {
            mode: "llm",
            systemPrompt: (systemPrompt ? `${systemPrompt}\n` : "") +
                "Always prioritize using the provided content to answer the question. Do not make up an answer. Do not hallucinate. In case you can't find the information and the string is required, instead of 'N/A' or 'Not speficied', return an empty string: '', if it's not a string and you can't find the information, return null. Be concise and follow the schema always if provided.",
            prompt: docsPrompt,
            schema: rSchema,
        },
        markdown: `${singleAnswerDocs.map((x, i) => `[START_PAGE (ID: ${i})]` + (0, build_document_1.buildDocument)(x)).join("\n")} [END_PAGE]\n`,
        isExtractEndpoint: true,
        model: (0, generic_ai_1.getModel)("gemini-2.5-pro", "vertex"),
        retryModel: (0, generic_ai_1.getModel)("gemini-2.5-pro", "google"),
        costTrackingOptions: {
            costTracking,
            metadata: {
                module: "extract",
                method: "singleAnswerCompletion",
            },
        },
    };
    const { extractedDataArray, warning } = await (0, extractSmartScrape_1.extractData)({
        extractOptions: generationOptions,
        urls: singleAnswerDocs.map(doc => doc.metadata.url || doc.metadata.sourceURL || ""),
        useAgent,
        extractId,
        sessionId,
    });
    const completion = {
        extract: extractedDataArray,
        tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            model: "gemini-2.5-pro",
        },
        sources: singleAnswerDocs.map((doc) => doc.metadata.url || doc.metadata.sourceURL || ""),
    };
    // const completion = await generateCompletions({
    //   logger: logger.child({ module: "extract", method: "generateCompletions" }),
    //   options: {
    //     mode: "llm",
    //     systemPrompt:
    //       (systemPrompt ? `${systemPrompt}\n` : "") +
    //       "Always prioritize using the provided content to answer the question. Do not make up an answer. Do not hallucinate. In case you can't find the information and the string is required, instead of 'N/A' or 'Not speficied', return an empty string: '', if it's not a string and you can't find the information, return null. Be concise and follow the schema always if provided.",
    //     prompt: "Today is: " + new Date().toISOString() + "\n" + prompt,
    //     schema: rSchema,
    //   },
    //   markdown: singleAnswerDocs.map((x) => buildDocument(x)).join("\n"),
    //   isExtractEndpoint: true,
    //   model: getModel("gemini-2.0-flash", "google"),
    // });
    // await fs.writeFile(
    //   `logs/singleAnswer-${crypto.randomUUID()}.json`,
    //   JSON.stringify(completion, null, 2),
    // );
    return {
        extract: completion.extract,
        tokenUsage: completion.tokenUsage,
        sources: singleAnswerDocs.map((doc) => doc.metadata.url || doc.metadata.sourceURL || ""),
    };
}
//# sourceMappingURL=singleAnswer.js.map