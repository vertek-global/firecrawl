"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searxng_search = searxng_search;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../lib/logger");
dotenv_1.default.config();
async function searxng_search(q, options) {
    const params = {
        q: q,
        language: options.lang,
        // gl: options.country, //not possible with SearXNG
        // location: options.location, //not possible with SearXNG
        // num: options.num_results, //not possible with SearXNG
        engines: process.env.SEARXNG_ENGINES || "",
        categories: process.env.SEARXNG_CATEGORIES || "",
        pageno: options.page ?? 1,
        format: "json"
    };
    const url = process.env.SEARXNG_ENDPOINT;
    // Remove trailing slash if it exists
    const cleanedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    // Concatenate "/search" to the cleaned URL
    const finalUrl = cleanedUrl + "/search";
    try {
        const response = await axios_1.default.get(finalUrl, {
            headers: {
                "Content-Type": "application/json",
            },
            params: params,
        });
        const data = response.data;
        if (data && Array.isArray(data.results)) {
            return data.results.map((a) => ({
                url: a.url,
                title: a.title,
                description: a.content,
            }));
        }
        else {
            return [];
        }
    }
    catch (error) {
        logger_1.logger.error(`There was an error searching for content`, { error });
        return [];
    }
}
//# sourceMappingURL=searxng.js.map