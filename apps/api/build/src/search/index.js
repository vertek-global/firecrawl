"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = search;
const logger_1 = require("../../src/lib/logger");
const googlesearch_1 = require("./googlesearch");
const searchapi_1 = require("./searchapi");
const serper_1 = require("./serper");
const searxng_1 = require("./searxng");
const fireEngine_1 = require("./fireEngine");
async function search({ query, advanced = false, num_results = 5, tbs = undefined, filter = undefined, lang = "en", country = "us", location = undefined, proxy = undefined, sleep_interval = 0, timeout = 5000, }) {
    try {
        if (process.env.FIRE_ENGINE_BETA_URL) {
            const results = await (0, fireEngine_1.fire_engine_search)(query, {
                numResults: num_results,
                tbs,
                filter,
                lang,
                country,
                location,
            });
            if (results.length > 0)
                return results;
        }
        if (process.env.SERPER_API_KEY) {
            const results = await (0, serper_1.serper_search)(query, {
                num_results,
                tbs,
                filter,
                lang,
                country,
                location,
            });
            if (results.length > 0)
                return results;
        }
        if (process.env.SEARCHAPI_API_KEY) {
            const results = await (0, searchapi_1.searchapi_search)(query, {
                num_results,
                tbs,
                filter,
                lang,
                country,
                location,
            });
            if (results.length > 0)
                return results;
        }
        if (process.env.SEARXNG_ENDPOINT) {
            const results = await (0, searxng_1.searxng_search)(query, {
                num_results,
                tbs,
                filter,
                lang,
                country,
                location,
            });
            if (results.length > 0)
                return results;
        }
        return await (0, googlesearch_1.googleSearch)(query, advanced, num_results, tbs, filter, lang, country, proxy, sleep_interval, timeout);
    }
    catch (error) {
        logger_1.logger.error(`Error in search function`, { error });
        return [];
    }
}
//# sourceMappingURL=index.js.map