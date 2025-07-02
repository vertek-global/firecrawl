"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_useragent = get_useragent;
exports.googleSearch = googleSearch;
const axios_1 = __importDefault(require("axios"));
const jsdom_1 = require("jsdom");
const entities_1 = require("../../src/lib/entities");
const logger_1 = require("../../src/lib/logger");
const https_1 = __importDefault(require("https"));
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
function get_useragent() {
    const lynx_version = `Lynx/${getRandomInt(2, 3)}.${getRandomInt(8, 9)}.${getRandomInt(0, 2)}`;
    const libwww_version = `libwww-FM/${getRandomInt(2, 3)}.${getRandomInt(13, 15)}`;
    const ssl_mm_version = `SSL-MM/${getRandomInt(1, 2)}.${getRandomInt(3, 5)}`;
    const openssl_version = `OpenSSL/${getRandomInt(1, 3)}.${getRandomInt(0, 4)}.${getRandomInt(0, 9)}`;
    return `${lynx_version} ${libwww_version} ${ssl_mm_version} ${openssl_version}`;
}
async function _req(term, results, lang, country, start, proxies, timeout, tbs = undefined, filter = undefined) {
    const params = {
        q: term,
        num: results + 2, // Number of results to return
        hl: lang,
        gl: country,
        safe: "active",
        start: start,
    };
    if (tbs) {
        params["tbs"] = tbs;
    }
    if (filter) {
        params["filter"] = filter;
    }
    var agent = get_useragent();
    try {
        const resp = await axios_1.default.get("https://www.google.com/search", {
            headers: {
                "User-Agent": agent,
                "Accept": "*/*"
            },
            params: params,
            proxy: proxies,
            timeout: timeout,
            httpsAgent: new https_1.default.Agent({
                rejectUnauthorized: true
            }),
            withCredentials: true
        });
        return resp;
    }
    catch (error) {
        if (error.response && error.response.status === 429) {
            logger_1.logger.warn("Google Search: Too many requests, try again later.", {
                status: error.response.status,
                statusText: error.response.statusText
            });
            throw new Error("Google Search: Too many requests, try again later.");
        }
        throw error;
    }
}
async function googleSearch(term, advanced = false, num_results = 5, tbs = undefined, filter = undefined, lang = "en", country = "us", proxy = undefined, sleep_interval = 0, timeout = 5000) {
    let proxies = null;
    if (proxy) {
        if (proxy.startsWith("https")) {
            proxies = { https: proxy };
        }
        else {
            proxies = { http: proxy };
        }
    }
    // TODO: knowledge graph, answer box, etc.
    let start = 0;
    let results = [];
    let attempts = 0;
    const maxAttempts = 20; // Define a maximum number of attempts to prevent infinite loop
    while (start < num_results && attempts < maxAttempts) {
        try {
            const resp = await _req(term, num_results - start, lang, country, start, proxies, timeout, tbs, filter);
            const dom = new jsdom_1.JSDOM(resp.data);
            const document = dom.window.document;
            const result_block = document.querySelectorAll("div.ezO2md");
            let new_results = 0;
            let unique = true;
            let fetched_results = 0;
            const fetched_links = new Set();
            if (result_block.length === 0) {
                start += 1;
                attempts += 1;
            }
            else {
                attempts = 0;
            }
            for (const result of result_block) {
                const link_tag = result.querySelector("a[href]");
                const title_tag = link_tag ? link_tag.querySelector("span.CVA68e") : null;
                const description_tag = result.querySelector("span.FrIlee");
                if (link_tag && title_tag && description_tag) {
                    const link = decodeURIComponent(link_tag.href.split("&")[0].replace("/url?q=", ""));
                    if (fetched_links.has(link) && unique)
                        continue;
                    fetched_links.add(link);
                    const title = title_tag.textContent || "";
                    const description = description_tag.textContent || "";
                    fetched_results++;
                    new_results++;
                    if (link && title && description) {
                        start += 1;
                        results.push(new entities_1.SearchResult(link, title, description));
                    }
                    if (fetched_results >= num_results)
                        break;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, sleep_interval * 1000));
        }
        catch (error) {
            if (error.message === "Too many requests") {
                logger_1.logger.warn("Too many requests, breaking the loop");
                break;
            }
            throw error;
        }
        if (start === 0) {
            return results;
        }
    }
    if (attempts >= maxAttempts) {
        logger_1.logger.warn("Max attempts reached, breaking the loop");
    }
    return results;
}
//# sourceMappingURL=googlesearch.js.map