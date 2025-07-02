"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDocumentToIndex = sendDocumentToIndex;
exports.scrapeURLWithIndex = scrapeURLWithIndex;
const services_1 = require("../../../../services");
const error_1 = require("../../error");
const crypto_1 = __importDefault(require("crypto"));
async function sendDocumentToIndex(meta, document) {
    const shouldCache = meta.options.storeInCache
        && !meta.internalOptions.zeroDataRetention
        && meta.winnerEngine !== "index"
        && meta.winnerEngine !== "index;documents"
        && (meta.internalOptions.teamId === "sitemap"
            || (meta.winnerEngine !== "fire-engine;tlsclient"
                && meta.winnerEngine !== "fire-engine;tlsclient;stealth"
                && meta.winnerEngine !== "fetch"))
        && !meta.featureFlags.has("actions")
        && (meta.options.headers === undefined
            || Object.keys(meta.options.headers).length === 0);
    if (!shouldCache) {
        return document;
    }
    (async () => {
        try {
            const normalizedURL = (0, services_1.normalizeURLForIndex)(meta.url);
            const urlHash = (0, services_1.hashURL)(normalizedURL);
            const urlSplits = (0, services_1.generateURLSplits)(normalizedURL);
            const urlSplitsHash = urlSplits.map(split => (0, services_1.hashURL)(split));
            const urlObj = new URL(normalizedURL);
            const hostname = urlObj.hostname;
            const domainSplits = (0, services_1.generateDomainSplits)(hostname);
            const domainSplitsHash = domainSplits.map(split => (0, services_1.hashURL)(split));
            const indexId = crypto_1.default.randomUUID();
            try {
                await (0, services_1.saveIndexToGCS)(indexId, {
                    url: normalizedURL,
                    html: document.rawHtml,
                    statusCode: document.metadata.statusCode,
                    error: document.metadata.error,
                    screenshot: document.screenshot,
                    numPages: document.metadata.numPages,
                });
            }
            catch (error) {
                meta.logger.error("Failed to save document to index", {
                    error,
                });
                return document;
            }
            let title = document.metadata.title ?? document.metadata.ogTitle ?? null;
            let description = document.metadata.description ?? document.metadata.ogDescription ?? document.metadata.dcDescription ?? null;
            if (typeof title === "string") {
                title = title.trim();
                if (title.length > 60) {
                    title = title.slice(0, 57) + "...";
                }
            }
            else {
                title = null;
            }
            if (typeof description === "string") {
                description = description.trim();
                if (description.length > 160) {
                    description = description.slice(0, 157) + "...";
                }
            }
            else {
                description = null;
            }
            try {
                await (0, services_1.addIndexInsertJob)({
                    id: indexId,
                    url: normalizedURL,
                    url_hash: urlHash,
                    original_url: document.metadata.sourceURL ?? meta.url,
                    resolved_url: document.metadata.url ?? document.metadata.sourceURL ?? meta.rewrittenUrl ?? meta.url,
                    has_screenshot: document.screenshot !== undefined && meta.featureFlags.has("screenshot"),
                    has_screenshot_fullscreen: document.screenshot !== undefined && meta.featureFlags.has("screenshot@fullScreen"),
                    is_mobile: meta.options.mobile,
                    block_ads: meta.options.blockAds,
                    location_country: meta.options.location?.country ?? null,
                    location_languages: meta.options.location?.languages ?? null,
                    status: document.metadata.statusCode,
                    ...(urlSplitsHash.slice(0, 10).reduce((a, x, i) => ({
                        ...a,
                        [`url_split_${i}_hash`]: x,
                    }), {})),
                    ...(domainSplitsHash.slice(0, 5).reduce((a, x, i) => ({
                        ...a,
                        [`domain_splits_${i}_hash`]: x,
                    }), {})),
                    ...(title ? { title } : {}),
                    ...(description ? { description } : {}),
                });
            }
            catch (error) {
                meta.logger.error("Failed to add document to index insert queue", {
                    error,
                });
            }
        }
        catch (error) {
            meta.logger.error("Failed to save document to index (outer)", {
                error,
            });
        }
    })();
    return document;
}
const errorCountToRegister = 3;
async function scrapeURLWithIndex(meta) {
    const normalizedURL = (0, services_1.normalizeURLForIndex)(meta.url);
    const urlHash = (0, services_1.hashURL)(normalizedURL);
    let selector = services_1.index_supabase_service
        .from("index")
        .select("id, created_at, status")
        .eq("url_hash", urlHash)
        .gte("created_at", new Date(Date.now() - meta.options.maxAge).toISOString())
        .eq("is_mobile", meta.options.mobile)
        .eq("block_ads", meta.options.blockAds);
    if (meta.featureFlags.has("screenshot")) {
        selector = selector.eq("has_screenshot", true);
    }
    if (meta.featureFlags.has("screenshot@fullScreen")) {
        selector = selector.eq("has_screenshot_fullscreen", true);
    }
    if (meta.options.location?.country) {
        selector = selector.eq("location_country", meta.options.location.country);
    }
    else {
        selector = selector.is("location_country", null);
    }
    if (meta.options.location?.languages) {
        selector = selector.eq("location_languages", meta.options.location.languages);
    }
    else {
        selector = selector.is("location_languages", null);
    }
    const { data, error } = await selector
        .order("created_at", { ascending: false })
        .limit(5);
    if (error) {
        throw new error_1.EngineError("Failed to retrieve URL from DB index", {
            cause: error,
        });
    }
    let selectedRow = null;
    if (data.length > 0) {
        const newest200Index = data.findIndex(x => x.status >= 200 && x.status < 300);
        // If the newest 200 index is further back than the allowed error count, we should display the errored index entry
        if (newest200Index >= errorCountToRegister || newest200Index === -1) {
            selectedRow = data[0];
        }
        else {
            selectedRow = data[newest200Index];
        }
    }
    if (selectedRow === null || selectedRow === undefined) {
        throw new error_1.IndexMissError();
    }
    const id = data[0].id;
    const doc = await (0, services_1.getIndexFromGCS)(id + ".json", meta.logger.child({ module: "index", method: "getIndexFromGCS" }));
    if (!doc) {
        throw new error_1.EngineError("Document not found in GCS");
    }
    return {
        url: doc.url,
        html: doc.html,
        statusCode: doc.statusCode,
        error: doc.error,
        screenshot: doc.screenshot,
        numPages: doc.numPages,
        cacheInfo: {
            created_at: new Date(data[0].created_at),
        },
        proxyUsed: doc.proxyUsed ?? "basic",
    };
}
//# sourceMappingURL=index.js.map