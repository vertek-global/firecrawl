"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performAgent = performAgent;
const logger_1 = require("../../../lib/logger");
const html_to_markdown_1 = require("../../../lib/html-to-markdown");
const smartScrape_1 = require("../lib/smartScrape");
async function performAgent(meta, document) {
    if (meta.options.agent?.prompt) {
        if (meta.internalOptions.zeroDataRetention) {
            document.warning = "Agent is not supported with zero data retention." + (document.warning ? " " + document.warning : "");
            return document;
        }
        const url = document.url || document.metadata.sourceURL;
        if (!url) {
            logger_1.logger.error("document.url or document.metadata.sourceURL is undefined -- this is unexpected");
            // throw new Error("document.url or document.metadata.sourceURL is undefined -- this is unexpected");
            return document;
        }
        const prompt = meta.options.agent?.prompt ?? undefined;
        const sessionId = meta.options.agent?.sessionId ?? undefined;
        let smartscrapeResults;
        try {
            smartscrapeResults = await (0, smartScrape_1.smartScrape)({
                url,
                prompt,
                sessionId,
                scrapeId: meta.id,
                costTracking: meta.costTracking,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === "Cost limit exceeded") {
                logger_1.logger.error("Cost limit exceeded", { error });
                document.warning = "Smart scrape cost limit exceeded." + (document.warning ? " " + document.warning : "");
                return document;
            }
            else {
                throw error;
            }
        }
        const html = smartscrapeResults.scrapedPages[smartscrapeResults.scrapedPages.length - 1].html;
        if (meta.options.formats.includes("markdown")) {
            const markdown = await (0, html_to_markdown_1.parseMarkdown)(html);
            document.markdown = markdown;
        }
        if (meta.options.formats.includes("html")) {
            document.html = html;
        }
    }
    return document;
}
//# sourceMappingURL=agent.js.map