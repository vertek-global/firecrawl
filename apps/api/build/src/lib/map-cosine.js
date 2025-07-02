"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performCosineSimilarity = performCosineSimilarity;
const logger_1 = require("./logger");
function performCosineSimilarity(links, searchQuery) {
    try {
        // Function to calculate cosine similarity
        const cosineSimilarity = (vec1, vec2) => {
            const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
            const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
            const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
            if (magnitude1 === 0 || magnitude2 === 0)
                return 0;
            return dotProduct / (magnitude1 * magnitude2);
        };
        // Function to convert text to vector
        const textToVector = (text) => {
            const words = searchQuery.toLowerCase().split(/\W+/);
            return words.map((word) => {
                const count = (text.toLowerCase().match(new RegExp(word, "g")) || [])
                    .length;
                return count / text.length;
            });
        };
        // Calculate similarity scores
        const similarityScores = links.map((link) => {
            const linkVector = textToVector(link);
            const searchVector = textToVector(searchQuery);
            return cosineSimilarity(linkVector, searchVector);
        });
        // Sort links based on similarity scores and print scores
        const a = links
            .map((link, index) => ({ link, score: similarityScores[index] }))
            .sort((a, b) => b.score - a.score);
        links = a.map((item) => item.link);
        return links;
    }
    catch (error) {
        logger_1.logger.error(`Error performing cosine similarity: ${error}`);
        return links;
    }
}
//# sourceMappingURL=map-cosine.js.map