"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performRanking_F0 = performRanking_F0;
const ai_1 = require("ai");
const dotenv_1 = require("dotenv");
const generic_ai_1 = require("../../../lib/generic-ai");
(0, dotenv_1.configDotenv)();
async function getEmbedding(text) {
    const { embedding } = await (0, ai_1.embed)({
        model: (0, generic_ai_1.getEmbeddingModel)("text-embedding-3-small"),
        value: text,
    });
    return embedding;
}
const cosineSimilarity = (vec1, vec2) => {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    if (magnitude1 === 0 || magnitude2 === 0)
        return 0;
    return dotProduct / (magnitude1 * magnitude2);
};
// Function to convert text to vector
const textToVector = (searchQuery, text) => {
    const words = searchQuery.toLowerCase().split(/\W+/);
    return words.map((word) => {
        const count = (text.toLowerCase().match(new RegExp(word, "g")) || [])
            .length;
        return count / text.length;
    });
};
async function performRanking_F0(linksWithContext, links, searchQuery) {
    try {
        // Handle invalid inputs
        if (!searchQuery || !linksWithContext.length || !links.length) {
            return [];
        }
        // Sanitize search query by removing null characters
        const sanitizedQuery = searchQuery;
        // Generate embeddings for the search query
        const queryEmbedding = await getEmbedding(sanitizedQuery);
        // Generate embeddings for each link and calculate similarity in parallel
        const linksAndScores = await Promise.all(linksWithContext.map((linkWithContext, index) => getEmbedding(linkWithContext)
            .then((linkEmbedding) => {
            const score = cosineSimilarity(queryEmbedding, linkEmbedding);
            return {
                link: links[index],
                linkWithContext,
                score,
                originalIndex: index,
            };
        })
            .catch(() => ({
            link: links[index],
            linkWithContext,
            score: 0,
            originalIndex: index,
        }))));
        // Sort links based on similarity scores while preserving original order for equal scores
        linksAndScores.sort((a, b) => {
            const scoreDiff = b.score - a.score;
            return scoreDiff === 0 ? a.originalIndex - b.originalIndex : scoreDiff;
        });
        return linksAndScores;
    }
    catch (error) {
        console.error(`Error performing semantic search: ${error}`);
        return [];
    }
}
//# sourceMappingURL=ranker-f0.js.map