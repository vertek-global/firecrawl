"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rerankDocuments_FO = rerankDocuments_FO;
exports.rerankLinks_F0 = rerankLinks_F0;
exports.rerankLinksWithLLM_F0 = rerankLinksWithLLM_F0;
const blocklist_1 = require("../../../scraper/WebScraper/utils/blocklist");
const logger_1 = require("../../logger");
const cohere_ai_1 = require("cohere-ai");
const config_1 = require("../config");
const llmExtract_1 = require("../../../scraper/scrapeURL/transformers/llmExtract");
const ranker_f0_1 = require("./ranker-f0");
const build_prompts_f0_1 = require("./build-prompts-f0");
const extraction_service_1 = require("../extraction-service");
const cohere = new cohere_ai_1.CohereClient({
    token: process.env.COHERE_API_KEY,
});
async function rerankDocuments_FO(documents, query, topN = 3, model = "rerank-english-v3.0") {
    const rerank = await cohere.v2.rerank({
        documents,
        query,
        topN,
        model,
        returnDocuments: true,
    });
    return rerank.results
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map((x) => ({
        document: x.document,
        index: x.index,
        relevanceScore: x.relevanceScore,
    }));
}
async function rerankLinks_F0(mappedLinks, searchQuery, urlTraces, flags) {
    // console.log("Going to rerank links");
    const mappedLinksRerank = mappedLinks.map((x) => `url: ${x.url}, title: ${x.title}, description: ${x.description}`);
    const linksAndScores = await (0, ranker_f0_1.performRanking_F0)(mappedLinksRerank, mappedLinks.map((l) => l.url), searchQuery);
    // First try with high threshold
    let filteredLinks = filterAndProcessLinks_F0(mappedLinks, linksAndScores, config_1.extractConfig.RERANKING.INITIAL_SCORE_THRESHOLD_FOR_RELEVANCE, flags);
    // If we don't have enough high-quality links, try with lower threshold
    if (filteredLinks.length < config_1.extractConfig.RERANKING.MIN_REQUIRED_LINKS) {
        logger_1.logger.info(`Only found ${filteredLinks.length} links with score > ${config_1.extractConfig.RERANKING.INITIAL_SCORE_THRESHOLD_FOR_RELEVANCE}. Trying lower threshold...`);
        filteredLinks = filterAndProcessLinks_F0(mappedLinks, linksAndScores, config_1.extractConfig.RERANKING.FALLBACK_SCORE_THRESHOLD_FOR_RELEVANCE, flags);
        if (filteredLinks.length === 0) {
            // If still no results, take top N results regardless of score
            logger_1.logger.warn(`No links found with score > ${config_1.extractConfig.RERANKING.FALLBACK_SCORE_THRESHOLD_FOR_RELEVANCE}. Taking top ${config_1.extractConfig.RERANKING.MIN_REQUIRED_LINKS} results.`);
            filteredLinks = linksAndScores
                .sort((a, b) => b.score - a.score)
                .slice(0, config_1.extractConfig.RERANKING.MIN_REQUIRED_LINKS)
                .map((x) => mappedLinks.find((link) => link.url === x.link))
                .filter((x) => x !== undefined && x.url !== undefined && !(0, blocklist_1.isUrlBlocked)(x.url, flags));
        }
    }
    // Update URL traces with relevance scores and mark filtered out URLs
    linksAndScores.forEach((score) => {
        const trace = urlTraces.find((t) => t.url === score.link);
        if (trace) {
            trace.relevanceScore = score.score;
            // If URL didn't make it through filtering, mark it as filtered out
            if (!filteredLinks.some((link) => link.url === score.link)) {
                trace.warning = `Relevance score ${score.score} below threshold`;
                trace.usedInCompletion = false;
            }
        }
    });
    const rankedLinks = filteredLinks.slice(0, config_1.extractConfig.RERANKING.MAX_RANKING_LIMIT_FOR_RELEVANCE);
    // Mark URLs that will be used in completion
    rankedLinks.forEach((link) => {
        const trace = urlTraces.find((t) => t.url === link.url);
        if (trace) {
            trace.usedInCompletion = true;
        }
    });
    // Mark URLs that were dropped due to ranking limit
    filteredLinks
        .slice(config_1.extractConfig.RERANKING.MAX_RANKING_LIMIT_FOR_RELEVANCE)
        .forEach((link) => {
        const trace = urlTraces.find((t) => t.url === link.url);
        if (trace) {
            trace.warning = "Excluded due to ranking limit";
            trace.usedInCompletion = false;
        }
    });
    // console.log("Reranked links: ", rankedLinks.length);
    return rankedLinks;
}
function filterAndProcessLinks_F0(mappedLinks, linksAndScores, threshold, flags) {
    return linksAndScores
        .filter((x) => x.score > threshold)
        .map((x) => mappedLinks.find((link) => link.url === x.link))
        .filter((x) => x !== undefined && x.url !== undefined && !(0, blocklist_1.isUrlBlocked)(x.url, flags));
}
async function rerankLinksWithLLM_F0(options, costTracking) {
    const { links, searchQuery, urlTraces } = options;
    const chunkSize = 100;
    const chunks = [];
    const TIMEOUT_MS = 20000;
    const MAX_RETRIES = 2;
    let totalTokensUsed = 0;
    // Split links into chunks of 200
    for (let i = 0; i < links.length; i += chunkSize) {
        chunks.push(links.slice(i, i + chunkSize));
    }
    // console.log(`Total links: ${mappedLinks.length}, Number of chunks: ${chunks.length}`);
    const schema = {
        type: "object",
        properties: {
            relevantLinks: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        url: { type: "string" },
                        relevanceScore: { type: "number" },
                        reason: { type: "string", description: "The reason why you chose the score for this link given the intent." },
                    },
                    required: ["url", "relevanceScore", "reason"],
                },
            },
        },
        required: ["relevantLinks"],
    };
    const results = await Promise.all(chunks.map(async (chunk, chunkIndex) => {
        // console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} links`);
        const linksContent = chunk
            .map((link) => `URL: ${link.url}${link.title ? `\nTitle: ${link.title}` : ""}${link.description ? `\nDescription: ${link.description}` : ""}`)
            .join("\n\n");
        for (let retry = 0; retry <= MAX_RETRIES; retry++) {
            try {
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(() => resolve(null), TIMEOUT_MS);
                });
                // dumpToFile(new Date().toISOString(),[buildRerankerSystemPrompt(), buildRerankerUserPrompt(searchQuery), schema, linksContent])
                const completionPromise = (0, llmExtract_1.generateCompletions)({
                    logger: logger_1.logger.child({
                        method: "rerankLinksWithLLM",
                        chunk: chunkIndex + 1,
                        retry,
                    }),
                    options: {
                        mode: "llm",
                        systemPrompt: (0, build_prompts_f0_1.buildRerankerSystemPrompt_F0)(),
                        prompt: (0, build_prompts_f0_1.buildRerankerUserPrompt_F0)(searchQuery),
                        schema: schema,
                    },
                    markdown: linksContent,
                    isExtractEndpoint: true,
                    costTrackingOptions: {
                        costTracking: new extraction_service_1.CostTracking(),
                        metadata: {
                            module: "extract",
                            method: "rerankLinksWithLLM",
                        },
                    },
                });
                const completion = await Promise.race([
                    completionPromise,
                    timeoutPromise,
                ]);
                if (!completion) {
                    // console.log(`Chunk ${chunkIndex + 1}: Timeout on attempt ${retry + 1}`);
                    continue;
                }
                if (!completion.extract?.relevantLinks) {
                    // console.warn(`Chunk ${chunkIndex + 1}: No relevant links found in completion response`);
                    return [];
                }
                totalTokensUsed += completion.numTokens || 0;
                // console.log(`Chunk ${chunkIndex + 1}: Found ${completion.extract.relevantLinks.length} relevant links`);
                return completion.extract.relevantLinks;
            }
            catch (error) {
                console.warn(`Error processing chunk ${chunkIndex + 1} attempt ${retry + 1}:`, error);
                if (retry === MAX_RETRIES) {
                    // console.log(`Chunk ${chunkIndex + 1}: Max retries reached, returning empty array`);
                    return [];
                }
            }
        }
        return [];
    }));
    // console.log(`Processed ${results.length} chunks`);
    // Flatten results and sort by relevance score
    const flattenedResults = results
        .flat()
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    // console.log(`Total relevant links found: ${flattenedResults.length}`);
    // Map back to MapDocument format, keeping only relevant links
    const relevantLinks = flattenedResults
        .map((result) => {
        const link = links.find((link) => link.url === result.url);
        if (link) {
            return { ...link, relevanceScore: result.relevanceScore ? parseFloat(result.relevanceScore) : 0, reason: result.reason };
        }
        return undefined;
    })
        .filter((link) => link !== undefined);
    return {
        mapDocument: relevantLinks,
        tokensUsed: totalTokensUsed,
    };
}
//# sourceMappingURL=reranker-f0.js.map