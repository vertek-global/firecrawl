"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLinks = extractLinks;
// TODO: refactor
const cheerio_1 = require("cheerio"); // rustified
const logger_1 = require("../../../lib/logger");
const html_transformer_1 = require("../../../lib/html-transformer");
async function extractLinksRust(html, baseUrl) {
    const hrefs = await (0, html_transformer_1.extractLinks)(html);
    const links = [];
    hrefs.forEach(href => {
        href = href.trim();
        try {
            if (href.startsWith("http://") || href.startsWith("https://")) {
                // Absolute URL, add as is
                links.push(href);
            }
            else if (href.startsWith("/")) {
                // Relative URL starting with '/', append to origin
                links.push(new URL(href, baseUrl).href);
            }
            else if (!href.startsWith("#") && !href.startsWith("mailto:")) {
                // Relative URL not starting with '/', append to base URL
                links.push(new URL(href, baseUrl).href);
            }
            else if (href.startsWith("mailto:")) {
                // mailto: links, add as is
                links.push(href);
            }
            // Fragment-only links (#) are ignored
        }
        catch (error) {
            logger_1.logger.error(`Failed to construct URL for href: ${href} with base: ${baseUrl}`, { error });
        }
    });
    // Remove duplicates and return
    return [...new Set(links)];
}
async function extractLinks(html, baseUrl) {
    try {
        return await extractLinksRust(html, baseUrl);
    }
    catch (error) {
        logger_1.logger.warn("Failed to call html-transformer! Falling back to cheerio...", {
            error,
            module: "scrapeURL", method: "extractLinks"
        });
    }
    const $ = (0, cheerio_1.load)(html);
    const links = [];
    $("a").each((_, element) => {
        let href = $(element).attr("href");
        if (href) {
            href = href.trim();
            try {
                if (href.startsWith("http://") || href.startsWith("https://")) {
                    // Absolute URL, add as is
                    links.push(href);
                }
                else if (href.startsWith("/")) {
                    // Relative URL starting with '/', append to origin
                    links.push(new URL(href, baseUrl).href);
                }
                else if (!href.startsWith("#") && !href.startsWith("mailto:")) {
                    // Relative URL not starting with '/', append to base URL
                    links.push(new URL(href, baseUrl).href);
                }
                else if (href.startsWith("mailto:")) {
                    // mailto: links, add as is
                    links.push(href);
                }
                // Fragment-only links (#) are ignored
            }
            catch (error) {
                logger_1.logger.error(`Failed to construct URL for href: ${href} with base: ${baseUrl}`, { error });
            }
        }
    });
    // Remove duplicates and return
    return [...new Set(links)];
}
//# sourceMappingURL=extractLinks.js.map