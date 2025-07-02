"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMetadataRust = extractMetadataRust;
exports.extractMetadata = extractMetadata;
const cheerio_1 = require("cheerio"); // rustified
const html_transformer_1 = require("../../../lib/html-transformer");
async function extractMetadataRust(meta, html) {
    const fromRust = await (0, html_transformer_1.extractMetadata)(html);
    return {
        ...fromRust,
        ...(fromRust.favicon ? {
            favicon: new URL(fromRust.favicon, meta.rewrittenUrl ?? meta.url)
        } : {}),
        scrapeId: meta.id,
    };
}
async function extractMetadata(meta, html) {
    try {
        return await extractMetadataRust(meta, html);
    }
    catch (error) {
        meta.logger.warn("Failed to call html-transformer! Falling back to cheerio...", {
            error,
            module: "scrapeURL", method: "extractMetadata"
        });
    }
    let title = undefined;
    let description = undefined;
    let favicon = undefined;
    let language = undefined;
    let keywords = undefined;
    let robots = undefined;
    let ogTitle = undefined;
    let ogDescription = undefined;
    let ogUrl = undefined;
    let ogImage = undefined;
    let ogAudio = undefined;
    let ogDeterminer = undefined;
    let ogLocale = undefined;
    let ogLocaleAlternate = undefined;
    let ogSiteName = undefined;
    let ogVideo = undefined;
    let dcTermsCreated = undefined;
    let dcDateCreated = undefined;
    let dcDate = undefined;
    let dcTermsType = undefined;
    let dcType = undefined;
    let dcTermsAudience = undefined;
    let dcTermsSubject = undefined;
    let dcSubject = undefined;
    let dcDescription = undefined;
    let dcTermsKeywords = undefined;
    let modifiedTime = undefined;
    let publishedTime = undefined;
    let articleTag = undefined;
    let articleSection = undefined;
    const customMetadata = {};
    const soup = (0, cheerio_1.load)(html);
    try {
        title = soup("title").first().text().trim() || undefined;
        description = soup('meta[name="description"]').attr("content") || undefined;
        const faviconLink = soup('link[rel="icon"]').attr("href") ||
            soup('link[rel*="icon"]').first().attr("href") ||
            undefined;
        if (faviconLink) {
            const baseUrl = new URL(meta.rewrittenUrl ?? meta.url).origin;
            favicon = faviconLink.startsWith("http")
                ? faviconLink
                : `${baseUrl}${faviconLink}`;
        }
        // Assuming the language is part of the URL as per the regex pattern
        language = soup("html").attr("lang") || undefined;
        keywords = soup('meta[name="keywords"]').attr("content") || undefined;
        robots = soup('meta[name="robots"]').attr("content") || undefined;
        ogTitle = soup('meta[property="og:title"]').attr("content") || undefined;
        ogDescription =
            soup('meta[property="og:description"]').attr("content") || undefined;
        ogUrl = soup('meta[property="og:url"]').attr("content") || undefined;
        ogImage = soup('meta[property="og:image"]').attr("content") || undefined;
        ogAudio = soup('meta[property="og:audio"]').attr("content") || undefined;
        ogDeterminer =
            soup('meta[property="og:determiner"]').attr("content") || undefined;
        ogLocale = soup('meta[property="og:locale"]').attr("content") || undefined;
        ogLocaleAlternate =
            soup('meta[property="og:locale:alternate"]')
                .map((i, el) => soup(el).attr("content"))
                .get() || undefined;
        ogSiteName =
            soup('meta[property="og:site_name"]').attr("content") || undefined;
        ogVideo = soup('meta[property="og:video"]').attr("content") || undefined;
        articleSection =
            soup('meta[name="article:section"]').attr("content") || undefined;
        articleTag = soup('meta[name="article:tag"]').attr("content") || undefined;
        publishedTime =
            soup('meta[property="article:published_time"]').attr("content") ||
                undefined;
        modifiedTime =
            soup('meta[property="article:modified_time"]').attr("content") ||
                undefined;
        dcTermsKeywords =
            soup('meta[name="dcterms.keywords"]').attr("content") || undefined;
        dcDescription =
            soup('meta[name="dc.description"]').attr("content") || undefined;
        dcSubject = soup('meta[name="dc.subject"]').attr("content") || undefined;
        dcTermsSubject =
            soup('meta[name="dcterms.subject"]').attr("content") || undefined;
        dcTermsAudience =
            soup('meta[name="dcterms.audience"]').attr("content") || undefined;
        dcType = soup('meta[name="dc.type"]').attr("content") || undefined;
        dcTermsType =
            soup('meta[name="dcterms.type"]').attr("content") || undefined;
        dcDate = soup('meta[name="dc.date"]').attr("content") || undefined;
        dcDateCreated =
            soup('meta[name="dc.date.created"]').attr("content") || undefined;
        dcTermsCreated =
            soup('meta[name="dcterms.created"]').attr("content") || undefined;
        try {
            // Extract all meta tags for custom metadata
            soup("meta").each((i, elem) => {
                try {
                    const name = soup(elem).attr("name") || soup(elem).attr("property") || soup(elem).attr("itemprop");
                    const content = soup(elem).attr("content");
                    if (name && content) {
                        if (name === "description") {
                            if (customMetadata[name] === undefined) {
                                customMetadata[name] = content;
                            }
                            else {
                                customMetadata[name] = Array.isArray(customMetadata[name])
                                    ? [...customMetadata[name], content].join(", ")
                                    : `${customMetadata[name]}, ${content}`;
                            }
                        }
                        else {
                            if (customMetadata[name] === undefined) {
                                customMetadata[name] = content;
                            }
                            else if (Array.isArray(customMetadata[name])) {
                                customMetadata[name].push(content);
                            }
                            else {
                                customMetadata[name] = [customMetadata[name], content];
                            }
                        }
                    }
                }
                catch (error) {
                    meta.logger.error(`Error extracting custom metadata (in)`, { error });
                }
            });
        }
        catch (error) {
            meta.logger.error(`Error extracting custom metadata`, { error });
        }
    }
    catch (error) {
        meta.logger.error(`Error extracting metadata`, { error });
    }
    return {
        title,
        description,
        favicon,
        language,
        keywords,
        robots,
        ogTitle,
        ogDescription,
        ogUrl,
        ogImage,
        ogAudio,
        ogDeterminer,
        ogLocale,
        ogLocaleAlternate,
        ogSiteName,
        ogVideo,
        dcTermsCreated,
        dcDateCreated,
        dcDate,
        dcTermsType,
        dcType,
        dcTermsAudience,
        dcTermsSubject,
        dcSubject,
        dcDescription,
        dcTermsKeywords,
        modifiedTime,
        publishedTime,
        articleTag,
        articleSection,
        scrapeId: meta.id,
        ...customMetadata,
    };
}
//# sourceMappingURL=extractMetadata.js.map