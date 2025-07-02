"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleAnswerCompletion_F0 = singleAnswerCompletion_F0;
const logger_1 = require("../../../../lib/logger");
const llmExtract_f0_1 = require("../llmExtract-f0");
const build_document_f0_1 = require("../build-document-f0");
async function singleAnswerCompletion_F0({ singleAnswerDocs, rSchema, links, prompt, systemPrompt, }) {
    const completion = await (0, llmExtract_f0_1.generateCompletions_F0)({
        logger: logger_1.logger.child({ module: "extract", method: "generateCompletions" }),
        options: {
            mode: "llm",
            systemPrompt: (systemPrompt ? `${systemPrompt}\n` : "") +
                "Always prioritize using the provided content to answer the question. Do not make up an answer. Do not hallucinate. In case you can't find the information and the string is required, instead of 'N/A' or 'Not speficied', return an empty string: '', if it's not a string and you can't find the information, return null. Be concise and follow the schema always if provided. Here are the urls the user provided of which he wants to extract information from: " +
                links.join(", "),
            prompt: "Today is: " + new Date().toISOString() + "\n" + prompt,
            schema: rSchema,
        },
        markdown: singleAnswerDocs.map((x) => (0, build_document_f0_1.buildDocument_F0)(x)).join("\n"),
        isExtractEndpoint: true
    });
    return {
        extract: completion.extract,
        tokenUsage: completion.totalUsage,
        sources: singleAnswerDocs.map(doc => doc.metadata.url || doc.metadata.sourceURL || "")
    };
}
//# sourceMappingURL=singleAnswer-f0.js.map