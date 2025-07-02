"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLinksFromSitemap = getLinksFromSitemap;
const xml2js_1 = require("xml2js");
const crawler_1 = require("./crawler");
const scrapeURL_1 = require("../scrapeURL");
const types_1 = require("../../controllers/v1/types");
const extraction_service_1 = require("../../lib/extract/extraction-service");
const useFireEngine = process.env.FIRE_ENGINE_BETA_URL !== "" &&
    process.env.FIRE_ENGINE_BETA_URL !== undefined;
async function getLinksFromSitemap({ sitemapUrl, urlsHandler, mode = "axios", maxAge = 0, zeroDataRetention, }, logger, crawlId, sitemapsHit, abort, mock) {
    if (sitemapsHit.size >= 20) {
        return 0;
    }
    if (sitemapsHit.has(sitemapUrl)) {
        logger.warn("This sitemap has already been hit.", { sitemapUrl });
        return 0;
    }
    sitemapsHit.add(sitemapUrl);
    try {
        let content = "";
        try {
            const response = await (0, scrapeURL_1.scrapeURL)("sitemap;" + crawlId, sitemapUrl, types_1.scrapeOptions.parse({ formats: ["rawHtml"], useMock: mock, maxAge }), {
                forceEngine: [
                    ...(maxAge > 0 ? ["index"] : []),
                    "fetch",
                    ...((mode === "fire-engine" && useFireEngine) ? ["fire-engine;tlsclient"] : []),
                ],
                v0DisableJsDom: true,
                abort,
                teamId: "sitemap",
                zeroDataRetention,
            }, new extraction_service_1.CostTracking());
            if (response.success &&
                response.document.metadata.statusCode >= 200 &&
                response.document.metadata.statusCode < 300) {
                content = response.document.rawHtml;
            }
            else {
                logger.error(`Request failed for sitemap fetch`, {
                    method: "getLinksFromSitemap",
                    mode,
                    sitemapUrl,
                    error: response.success
                        ? response.document
                        : response.error,
                });
                return 0;
            }
        }
        catch (error) {
            if (error instanceof types_1.TimeoutSignal) {
                throw error;
            }
            else {
                logger.error(`Request failed for sitemap fetch`, {
                    method: "getLinksFromSitemap",
                    mode,
                    sitemapUrl,
                    error,
                });
                return 0;
            }
        }
        const parsed = await (0, xml2js_1.parseStringPromise)(content);
        const root = parsed.urlset || parsed.sitemapindex;
        let count = 0;
        if (root && root.sitemap) {
            // Handle sitemap index files
            const sitemapUrls = root.sitemap
                .filter((sitemap) => sitemap.loc && sitemap.loc.length > 0)
                .map((sitemap) => sitemap.loc[0].trim());
            const sitemapPromises = sitemapUrls.map((sitemapUrl) => getLinksFromSitemap({ sitemapUrl, urlsHandler, mode, zeroDataRetention }, logger, crawlId, sitemapsHit, abort, mock));
            const results = await Promise.all(sitemapPromises);
            count = results.reduce((a, x) => a + x);
        }
        else if (root && root.url) {
            // Check if any URLs point to additional sitemaps
            const xmlSitemaps = root.url
                .filter((url) => url.loc &&
                url.loc.length > 0 &&
                url.loc[0].trim().toLowerCase().endsWith(".xml"))
                .map((url) => url.loc[0].trim());
            if (xmlSitemaps.length > 0) {
                // Recursively fetch links from additional sitemaps
                const sitemapPromises = xmlSitemaps.map((sitemapUrl) => getLinksFromSitemap({ sitemapUrl: sitemapUrl, urlsHandler, mode, zeroDataRetention }, logger, crawlId, sitemapsHit, abort, mock));
                count += (await Promise.all(sitemapPromises)).reduce((a, x) => a + x, 0);
            }
            const validUrls = root.url
                .filter((url) => url.loc &&
                url.loc.length > 0 &&
                !url.loc[0].trim().toLowerCase().endsWith(".xml") &&
                !crawler_1.WebCrawler.prototype.isFile(url.loc[0].trim()))
                .map((url) => url.loc[0].trim());
            count += validUrls.length;
            const h = urlsHandler(validUrls);
            if (h instanceof Promise) {
                await h;
            }
        }
        return count;
    }
    catch (error) {
        logger.debug(`Error processing sitemapUrl: ${sitemapUrl}`, {
            method: "getLinksFromSitemap",
            mode,
            sitemapUrl,
            error,
        });
    }
    return 0;
}
//# sourceMappingURL=sitemap.js.map