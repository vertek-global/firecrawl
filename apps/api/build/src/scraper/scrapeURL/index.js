"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeURL = scrapeURL;
const Sentry = __importStar(require("@sentry/node"));
const types_1 = require("../../controllers/v1/types");
const logger_1 = require("../../lib/logger");
const engines_1 = require("./engines");
const html_to_markdown_1 = require("../../lib/html-to-markdown");
const error_1 = require("./error");
const transformers_1 = require("./transformers");
const llmExtract_1 = require("./transformers/llmExtract");
const urlSpecificParams_1 = require("./lib/urlSpecificParams");
const mock_1 = require("./lib/mock");
function buildFeatureFlags(url, options, internalOptions) {
    const flags = new Set();
    if (options.actions !== undefined) {
        flags.add("actions");
    }
    if (options.formats.includes("screenshot")) {
        flags.add("screenshot");
    }
    if (options.formats.includes("screenshot@fullPage")) {
        flags.add("screenshot@fullScreen");
    }
    if (options.waitFor !== 0) {
        flags.add("waitFor");
    }
    if (internalOptions.atsv) {
        flags.add("atsv");
    }
    if (options.location || options.geolocation) {
        flags.add("location");
    }
    if (options.mobile) {
        flags.add("mobile");
    }
    if (options.skipTlsVerification) {
        flags.add("skipTlsVerification");
    }
    if (options.fastMode) {
        flags.add("useFastMode");
    }
    if (options.proxy === "stealth") {
        flags.add("stealthProxy");
    }
    const urlO = new URL(url);
    if (urlO.pathname.endsWith(".pdf")) {
        flags.add("pdf");
    }
    if (urlO.pathname.endsWith(".docx")) {
        flags.add("docx");
    }
    if (options.blockAds === false) {
        flags.add("disableAdblock");
    }
    return flags;
}
// Convenience URL rewrites, "fake redirects" in essence.
// Used to rewrite commonly used non-scrapable URLs to their scrapable equivalents.
function rewriteUrl(url) {
    if (url.startsWith("https://docs.google.com/document/d/") || url.startsWith("http://docs.google.com/document/d/")) {
        const id = url.match(/\/document\/d\/([-\w]+)/)?.[1];
        if (id) {
            return `https://docs.google.com/document/d/${id}/export?format=pdf`;
        }
    }
    else if (url.startsWith("https://docs.google.com/presentation/d/") || url.startsWith("http://docs.google.com/presentation/d/")) {
        const id = url.match(/\/presentation\/d\/([-\w]+)/)?.[1];
        if (id) {
            return `https://docs.google.com/presentation/d/${id}/export?format=pdf`;
        }
    }
    return undefined;
}
// The meta object contains all required information to perform a scrape.
// For example, the scrape ID, URL, options, feature flags, logs that occur while scraping.
// The meta object is usually immutable, except for the logs array, and in edge cases (e.g. a new feature is suddenly required)
// Having a meta object that is treated as immutable helps the code stay clean and easily tracable,
// while also retaining the benefits that WebScraper had from its OOP design.
async function buildMetaObject(id, url, options, internalOptions, costTracking) {
    const specParams = urlSpecificParams_1.urlSpecificParams[new URL(url).hostname.replace(/^www\./, "")];
    if (specParams !== undefined) {
        options = Object.assign(options, specParams.scrapeOptions);
        internalOptions = Object.assign(internalOptions, specParams.internalOptions);
    }
    const logger = logger_1.logger.child({
        module: "ScrapeURL",
        scrapeId: id,
        scrapeURL: url,
        zeroDataRetention: internalOptions.zeroDataRetention,
    });
    const logs = [];
    return {
        id,
        url,
        rewrittenUrl: rewriteUrl(url),
        options,
        internalOptions,
        logger,
        logs,
        featureFlags: buildFeatureFlags(url, options, internalOptions),
        mock: options.useMock !== undefined
            ? await (0, mock_1.loadMock)(options.useMock, logger_1.logger)
            : null,
        pdfPrefetch: undefined,
        costTracking,
        results: {},
    };
}
function safeguardCircularError(error) {
    if (typeof error === "object" && error !== null && error.results) {
        const newError = structuredClone(error);
        delete newError.results;
        return newError;
    }
    else {
        return error;
    }
}
async function scrapeURLLoop(meta) {
    meta.logger.info(`Scraping URL ${JSON.stringify(meta.rewrittenUrl ?? meta.url)}...`);
    if (meta.internalOptions.zeroDataRetention) {
        if (meta.featureFlags.has("screenshot")) {
            throw new error_1.ZDRViolationError("screenshot");
        }
        if (meta.featureFlags.has("screenshot@fullScreen")) {
            throw new error_1.ZDRViolationError("screenshot@fullScreen");
        }
        if (meta.options.actions && meta.options.actions.find(x => x.type === "screenshot")) {
            throw new error_1.ZDRViolationError("screenshot action");
        }
        if (meta.options.actions && meta.options.actions.find(x => x.type === "pdf")) {
            throw new error_1.ZDRViolationError("pdf action");
        }
    }
    // TODO: handle sitemap data, see WebScraper/index.ts:280
    // TODO: ScrapeEvents
    const fallbackList = (0, engines_1.buildFallbackList)(meta);
    let result = null;
    const timeToRun = meta.options.timeout !== undefined
        ? Math.round(meta.options.timeout / Math.min(fallbackList.length, 2))
        : (!meta.options.actions && !meta.options.jsonOptions && !meta.options.extract)
            ? Math.round(120000 / Math.min(fallbackList.length, 2))
            : undefined;
    for (const { engine, unsupportedFeatures } of fallbackList) {
        meta.internalOptions.abort?.throwIfAborted();
        const startedAt = Date.now();
        try {
            meta.logger.info("Scraping via " + engine + "...");
            const _engineResult = await (0, engines_1.scrapeURLWithEngine)(meta, engine, timeToRun);
            if (_engineResult.markdown === undefined) {
                // Some engines emit Markdown directly.
                _engineResult.markdown = await (0, html_to_markdown_1.parseMarkdown)(_engineResult.html);
            }
            const engineResult = _engineResult;
            // Success factors
            const isLongEnough = engineResult.markdown.length > 0;
            const isGoodStatusCode = (engineResult.statusCode >= 200 && engineResult.statusCode < 300) ||
                engineResult.statusCode === 304;
            const hasNoPageError = engineResult.error === undefined;
            const isLikelyProxyError = [403, 429].includes(engineResult.statusCode);
            meta.results[engine] = {
                state: "success",
                result: engineResult,
                factors: { isLongEnough, isGoodStatusCode, hasNoPageError, isLikelyProxyError },
                unsupportedFeatures,
                startedAt,
                finishedAt: Date.now(),
            };
            if (isLikelyProxyError && meta.options.proxy === "auto" && !meta.featureFlags.has("stealthProxy")) {
                meta.logger.info("Scrape via " + engine + " deemed unsuccessful due to proxy inadequacy. Adding stealthProxy flag.");
                throw new error_1.AddFeatureError(["stealthProxy"]);
            }
            // NOTE: TODO: what to do when status code is bad is tough...
            // we cannot just rely on text because error messages can be brief and not hit the limit
            // should we just use all the fallbacks and pick the one with the longest text? - mogery
            if (isLongEnough || !isGoodStatusCode) {
                meta.logger.info("Scrape via " + engine + " deemed successful.", {
                    factors: { isLongEnough, isGoodStatusCode, hasNoPageError },
                });
                result = {
                    engine,
                    unsupportedFeatures,
                    result: engineResult,
                };
                meta.winnerEngine = engine;
                break;
            }
        }
        catch (error) {
            if (error instanceof error_1.EngineError) {
                meta.logger.warn("Engine " + engine + " could not scrape the page.", {
                    error,
                });
                meta.results[engine] = {
                    state: "error",
                    error: safeguardCircularError(error),
                    unexpected: false,
                    startedAt,
                    finishedAt: Date.now(),
                };
            }
            else if (error instanceof error_1.IndexMissError) {
                meta.logger.info("Engine " + engine + " could not find the page in the index.", {
                    error,
                });
                meta.results[engine] = {
                    state: "error",
                    error: safeguardCircularError(error),
                    unexpected: false,
                    startedAt,
                    finishedAt: Date.now(),
                };
            }
            else if (error instanceof error_1.TimeoutError) {
                meta.logger.info("Engine " + engine + " timed out while scraping.", {
                    error,
                });
                meta.results[engine] = {
                    state: "timeout",
                    startedAt,
                    finishedAt: Date.now(),
                };
            }
            else if (error instanceof error_1.AddFeatureError ||
                error instanceof error_1.RemoveFeatureError) {
                throw error;
            }
            else if (error instanceof llmExtract_1.LLMRefusalError) {
                meta.results[engine] = {
                    state: "error",
                    error: safeguardCircularError(error),
                    unexpected: true,
                    startedAt,
                    finishedAt: Date.now(),
                };
                error.results = meta.results;
                meta.logger.warn("LLM refusal encountered", { error });
                throw error;
            }
            else if (error instanceof error_1.SiteError) {
                throw error;
            }
            else if (error instanceof error_1.SSLError) {
                throw error;
            }
            else if (error instanceof error_1.DNSResolutionError) {
                throw error;
            }
            else if (error instanceof error_1.ActionError) {
                throw error;
            }
            else if (error instanceof error_1.UnsupportedFileError) {
                throw error;
            }
            else if (error instanceof error_1.PDFAntibotError) {
                throw error;
            }
            else if (error instanceof types_1.TimeoutSignal) {
                throw error;
            }
            else if (error instanceof error_1.PDFInsufficientTimeError) {
                throw error;
            }
            else if (error instanceof error_1.FEPageLoadFailed) {
                meta.results[engine] = {
                    state: "error",
                    error,
                    unexpected: false,
                    startedAt,
                    finishedAt: Date.now(),
                };
            }
            else {
                Sentry.captureException(error);
                meta.logger.warn("An unexpected error happened while scraping with " + engine + ".", { error });
                meta.results[engine] = {
                    state: "error",
                    error: safeguardCircularError(error),
                    unexpected: true,
                    startedAt,
                    finishedAt: Date.now(),
                };
            }
        }
    }
    if (result === null) {
        throw new error_1.NoEnginesLeftError(fallbackList.map((x) => x.engine), meta.results);
    }
    let document = {
        markdown: result.result.markdown,
        rawHtml: result.result.html,
        screenshot: result.result.screenshot,
        actions: result.result.actions,
        metadata: {
            sourceURL: meta.internalOptions.unnormalizedSourceURL ?? meta.url,
            url: result.result.url,
            statusCode: result.result.statusCode,
            error: result.result.error,
            numPages: result.result.numPages,
            contentType: result.result.contentType,
            proxyUsed: meta.featureFlags.has("stealthProxy") ? "stealth" : "basic",
            ...((meta.results["index"] || meta.results["index;documents"]) ? (result.result.cacheInfo ? {
                cacheState: "hit",
                cachedAt: result.result.cacheInfo.created_at.toISOString(),
            } : {
                cacheState: "miss",
            }) : {})
        },
    };
    if (result.unsupportedFeatures.size > 0) {
        const warning = `The engine used does not support the following features: ${[...result.unsupportedFeatures].join(", ")} -- your scrape may be partial.`;
        meta.logger.warn(warning, {
            engine: result.engine,
            unsupportedFeatures: result.unsupportedFeatures,
        });
        document.warning =
            document.warning !== undefined
                ? document.warning + " " + warning
                : warning;
    }
    document = await (0, transformers_1.executeTransformers)(meta, document);
    return {
        success: true,
        document,
        logs: meta.logs,
        engines: meta.results,
    };
}
async function scrapeURL(id, url, options, internalOptions, costTracking) {
    const meta = await buildMetaObject(id, url, options, internalOptions, costTracking);
    if (meta.rewrittenUrl) {
        meta.logger.info("Rewriting URL");
    }
    try {
        while (true) {
            try {
                return await scrapeURLLoop(meta);
            }
            catch (error) {
                if (error instanceof error_1.AddFeatureError &&
                    meta.internalOptions.forceEngine === undefined) {
                    meta.logger.debug("More feature flags requested by scraper: adding " +
                        error.featureFlags.join(", "), { error, existingFlags: meta.featureFlags });
                    meta.featureFlags = new Set([...meta.featureFlags].concat(error.featureFlags));
                    if (error.pdfPrefetch) {
                        meta.pdfPrefetch = error.pdfPrefetch;
                    }
                }
                else if (error instanceof error_1.RemoveFeatureError &&
                    meta.internalOptions.forceEngine === undefined) {
                    meta.logger.debug("Incorrect feature flags reported by scraper: removing " +
                        error.featureFlags.join(","), { error, existingFlags: meta.featureFlags });
                    meta.featureFlags = new Set([...meta.featureFlags].filter((x) => !error.featureFlags.includes(x)));
                }
                else if (error instanceof error_1.PDFAntibotError &&
                    meta.internalOptions.forceEngine === undefined) {
                    if (meta.pdfPrefetch !== undefined) {
                        meta.logger.error("PDF was prefetched and still blocked by antibot, failing");
                        throw error;
                    }
                    else {
                        meta.logger.debug("PDF was blocked by anti-bot, prefetching with chrome-cdp");
                        meta.featureFlags = new Set([...meta.featureFlags].filter((x) => x !== "pdf"));
                    }
                }
                else {
                    throw error;
                }
            }
        }
    }
    catch (error) {
        if (Object.values(meta.results).length > 0 && Object.values(meta.results).every(x => x.state === "error" && x.error instanceof error_1.FEPageLoadFailed)) {
            throw new error_1.FEPageLoadFailed();
        }
        else if (error instanceof error_1.NoEnginesLeftError) {
            meta.logger.warn("scrapeURL: All scraping engines failed!", { error });
        }
        else if (error instanceof llmExtract_1.LLMRefusalError) {
            meta.logger.warn("scrapeURL: LLM refused to extract content", { error });
        }
        else if (error instanceof Error &&
            error.message.includes("Invalid schema for response_format")) {
            // TODO: seperate into custom error
            meta.logger.warn("scrapeURL: LLM schema error", { error });
            // TODO: results?
        }
        else if (error instanceof error_1.SiteError) {
            meta.logger.warn("scrapeURL: Site failed to load in browser", { error });
        }
        else if (error instanceof error_1.SSLError) {
            meta.logger.warn("scrapeURL: SSL error", { error });
        }
        else if (error instanceof error_1.ActionError) {
            meta.logger.warn("scrapeURL: Action(s) failed to complete", { error });
        }
        else if (error instanceof error_1.UnsupportedFileError) {
            meta.logger.warn("scrapeURL: Tried to scrape unsupported file", {
                error,
            });
        }
        else if (error instanceof error_1.PDFInsufficientTimeError) {
            meta.logger.warn("scrapeURL: Insufficient time to process PDF", { error });
        }
        else if (error instanceof error_1.PDFPrefetchFailed) {
            meta.logger.warn("scrapeURL: Failed to prefetch PDF that is protected by anti-bot", { error });
        }
        else if (error instanceof types_1.TimeoutSignal) {
            throw error;
        }
        else {
            Sentry.captureException(error);
            meta.logger.error("scrapeURL: Unexpected error happened", { error });
            // TODO: results?
        }
        return {
            success: false,
            error,
            logs: meta.logs,
            engines: meta.results,
        };
    }
}
//# sourceMappingURL=index.js.map