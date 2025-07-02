"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchapi_search = searchapi_search;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function searchapi_search(q, options) {
    const params = {
        q: q,
        hl: options.lang,
        gl: options.country,
        location: options.location,
        num: options.num_results,
        page: options.page ?? 1,
        engine: process.env.SEARCHAPI_ENGINE || "google",
    };
    const url = `https://www.searchapi.io/api/v1/search`;
    try {
        const response = await axios_1.default.get(url, {
            headers: {
                Authorization: `Bearer ${process.env.SEARCHAPI_API_KEY}`,
                "Content-Type": "application/json",
                "X-SearchApi-Source": "Firecrawl",
            },
            params: params,
        });
        if (response.status === 401) {
            throw new Error("Unauthorized. Please check your API key.");
        }
        const data = response.data;
        if (data && Array.isArray(data.organic_results)) {
            return data.organic_results.map((a) => ({
                url: a.link,
                title: a.title,
                description: a.snippet,
            }));
        }
        else {
            return [];
        }
    }
    catch (error) {
        console.error(`There was an error searching for content: ${error.message}`);
        return [];
    }
}
//# sourceMappingURL=searchapi.js.map