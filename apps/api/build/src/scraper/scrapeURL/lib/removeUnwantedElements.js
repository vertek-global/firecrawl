"use strict";
// TODO: refactor
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlTransform = void 0;
const cheerio_1 = require("cheerio"); // rustified
const html_transformer_1 = require("../../../lib/html-transformer");
const logger_1 = require("../../../lib/logger");
const excludeNonMainTags = [
    "header",
    "footer",
    "nav",
    "aside",
    ".header",
    ".top",
    ".navbar",
    "#header",
    ".footer",
    ".bottom",
    "#footer",
    ".sidebar",
    ".side",
    ".aside",
    "#sidebar",
    ".modal",
    ".popup",
    "#modal",
    ".overlay",
    ".ad",
    ".ads",
    ".advert",
    "#ad",
    ".lang-selector",
    ".language",
    "#language-selector",
    ".social",
    ".social-media",
    ".social-links",
    "#social",
    ".menu",
    ".navigation",
    "#nav",
    ".breadcrumbs",
    "#breadcrumbs",
    ".share",
    "#share",
    ".widget",
    "#widget",
    ".cookie",
    "#cookie",
];
const forceIncludeMainTags = [
    "#main",
    ".swoogo-cols",
    ".swoogo-text",
    ".swoogo-table-div",
    ".swoogo-space",
    ".swoogo-alert",
    ".swoogo-sponsors",
    ".swoogo-title",
    ".swoogo-tabs",
    ".swoogo-logo",
    ".swoogo-image",
    ".swoogo-button",
    ".swoogo-agenda"
];
const htmlTransform = async (html, url, scrapeOptions) => {
    try {
        return await (0, html_transformer_1.transformHtml)({
            html,
            url,
            include_tags: (scrapeOptions.includeTags ?? []).map(x => x.trim()).filter((x) => x.length !== 0),
            exclude_tags: (scrapeOptions.excludeTags ?? []).map(x => x.trim()).filter((x) => x.length !== 0),
            only_main_content: scrapeOptions.onlyMainContent,
        });
    }
    catch (error) {
        logger_1.logger.warn("Failed to call html-transformer! Falling back to cheerio...", {
            error,
            module: "scrapeURL", method: "extractLinks"
        });
    }
    let soup = (0, cheerio_1.load)(html);
    // remove unwanted elements
    if (scrapeOptions.includeTags &&
        scrapeOptions.includeTags.filter((x) => x.trim().length !== 0).length > 0) {
        // Create a new root element to hold the tags to keep
        const newRoot = (0, cheerio_1.load)("<div></div>")("div");
        scrapeOptions.includeTags.forEach((tag) => {
            soup(tag).each((_, element) => {
                newRoot.append(soup(element).clone());
            });
        });
        soup = (0, cheerio_1.load)(newRoot.html() ?? "");
    }
    soup("script, style, noscript, meta, head").remove();
    if (scrapeOptions.excludeTags &&
        scrapeOptions.excludeTags.filter((x) => x.trim().length !== 0).length > 0) {
        scrapeOptions.excludeTags.forEach((tag) => {
            let elementsToRemove;
            if (tag.startsWith("*") && tag.endsWith("*")) {
                let classMatch = false;
                const regexPattern = new RegExp(tag.slice(1, -1), "i");
                elementsToRemove = soup("*").filter((i, element) => {
                    if (element.type === "tag") {
                        const attributes = element.attribs;
                        const tagNameMatches = regexPattern.test(element.name);
                        const attributesMatch = Object.keys(attributes).some((attr) => regexPattern.test(`${attr}="${attributes[attr]}"`));
                        if (tag.startsWith("*.")) {
                            classMatch = Object.keys(attributes).some((attr) => regexPattern.test(`class="${attributes[attr]}"`));
                        }
                        return tagNameMatches || attributesMatch || classMatch;
                    }
                    return false;
                });
            }
            else {
                elementsToRemove = soup(tag);
            }
            elementsToRemove.remove();
        });
    }
    if (scrapeOptions.onlyMainContent) {
        excludeNonMainTags.forEach((tag) => {
            const elementsToRemove = soup(tag).filter(forceIncludeMainTags.map((x) => ":not(:has(" + x + "))").join(""));
            elementsToRemove.remove();
        });
    }
    // always return biggest image
    soup("img[srcset]").each((_, el) => {
        const sizes = el.attribs.srcset.split(",").map((x) => {
            const tok = x.trim().split(" ");
            return {
                url: tok[0],
                size: parseInt((tok[1] ?? "1x").slice(0, -1), 10),
                isX: (tok[1] ?? "").endsWith("x"),
            };
        });
        if (sizes.every((x) => x.isX) && el.attribs.src) {
            sizes.push({
                url: el.attribs.src,
                size: 1,
                isX: true,
            });
        }
        sizes.sort((a, b) => b.size - a.size);
        el.attribs.src = sizes[0]?.url;
    });
    // absolute links
    soup("img[src]").each((_, el) => {
        try {
            el.attribs.src = new URL(el.attribs.src, url).href;
        }
        catch (_) { }
    });
    soup("a[href]").each((_, el) => {
        try {
            el.attribs.href = new URL(el.attribs.href, url).href;
        }
        catch (_) { }
    });
    const cleanedHtml = soup.html();
    return cleanedHtml;
};
exports.htmlTransform = htmlTransform;
//# sourceMappingURL=removeUnwantedElements.js.map