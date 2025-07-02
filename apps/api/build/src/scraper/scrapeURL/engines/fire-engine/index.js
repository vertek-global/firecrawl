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
exports.scrapeURLWithFireEngineChromeCDP = scrapeURLWithFireEngineChromeCDP;
exports.scrapeURLWithFireEnginePlaywright = scrapeURLWithFireEnginePlaywright;
exports.scrapeURLWithFireEngineTLSClient = scrapeURLWithFireEngineTLSClient;
const scrape_1 = require("./scrape");
const checkStatus_1 = require("./checkStatus");
const error_1 = require("../../error");
const Sentry = __importStar(require("@sentry/node"));
const specialtyHandler_1 = require("../utils/specialtyHandler");
const delete_1 = require("./delete");
const html_transformer_1 = require("../../../../lib/html-transformer");
const types_1 = require("../../../../controllers/v1/types");
// This function does not take `Meta` on purpose. It may not access any
// meta values to construct the request -- that must be done by the
// `scrapeURLWithFireEngine*` functions.
async function performFireEngineScrape(meta, logger, request, timeout, mock, abort) {
    const scrape = await (0, scrape_1.fireEngineScrape)(logger.child({ method: "fireEngineScrape" }), request, mock, abort);
    const startTime = Date.now();
    const errorLimit = 3;
    let errors = [];
    let status = undefined;
    while (status === undefined) {
        abort?.throwIfAborted();
        if (errors.length >= errorLimit) {
            logger.error("Error limit hit.", { errors });
            (0, delete_1.fireEngineDelete)(logger.child({
                method: "performFireEngineScrape/fireEngineDelete",
                afterErrors: errors,
            }), scrape.jobId, mock);
            throw new Error("Error limit hit. See e.cause.errors for errors.", {
                cause: { errors },
            });
        }
        if (Date.now() - startTime > timeout) {
            logger.info("Fire-engine was unable to scrape the page before timing out.", { errors, timeout });
            throw new error_1.TimeoutError("Fire-engine was unable to scrape the page before timing out", { cause: { errors, timeout } });
        }
        try {
            status = await (0, checkStatus_1.fireEngineCheckStatus)(meta, logger.child({ method: "fireEngineCheckStatus" }), scrape.jobId, mock, abort);
        }
        catch (error) {
            if (error instanceof checkStatus_1.StillProcessingError) {
                // nop
            }
            else if (error instanceof error_1.EngineError ||
                error instanceof error_1.SiteError ||
                error instanceof error_1.SSLError ||
                error instanceof error_1.DNSResolutionError ||
                error instanceof error_1.ActionError ||
                error instanceof error_1.UnsupportedFileError ||
                error instanceof error_1.FEPageLoadFailed) {
                (0, delete_1.fireEngineDelete)(logger.child({
                    method: "performFireEngineScrape/fireEngineDelete",
                    afterError: error,
                }), scrape.jobId, mock);
                logger.debug("Fire-engine scrape job failed.", {
                    error,
                    jobId: scrape.jobId,
                });
                throw error;
            }
            else if (error instanceof types_1.TimeoutSignal) {
                (0, delete_1.fireEngineDelete)(logger.child({
                    method: "performFireEngineScrape/fireEngineDelete",
                    afterError: error,
                }), scrape.jobId, mock);
                throw error;
            }
            else {
                Sentry.captureException(error);
                errors.push(error);
                logger.debug(`An unexpeceted error occurred while calling checkStatus. Error counter is now at ${errors.length}.`, { error, jobId: scrape.jobId });
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await (0, specialtyHandler_1.specialtyScrapeCheck)(logger.child({
        method: "performFireEngineScrape/specialtyScrapeCheck",
    }), status.responseHeaders, status);
    const contentType = (Object.entries(status.responseHeaders ?? {}).find((x) => x[0].toLowerCase() === "content-type") ?? [])[1] ?? "";
    if (contentType.includes("application/json")) {
        status.content = await (0, html_transformer_1.getInnerJSON)(status.content);
    }
    if (status.file) {
        const content = status.file.content;
        delete status.file;
        status.content = Buffer.from(content, "base64").toString("utf8"); // TODO: handle other encodings via Content-Type tag
    }
    (0, delete_1.fireEngineDelete)(logger.child({
        method: "performFireEngineScrape/fireEngineDelete",
    }), scrape.jobId, mock);
    return status;
}
async function scrapeURLWithFireEngineChromeCDP(meta, timeToRun) {
    const actions = [
        // Transform waitFor option into an action (unsupported by chrome-cdp)
        ...(meta.options.waitFor !== 0
            ? [
                {
                    type: "wait",
                    milliseconds: meta.options.waitFor > 30000 ? 30000 : meta.options.waitFor,
                },
            ]
            : []),
        // Include specified actions
        ...(meta.options.actions ?? []),
        // Transform screenshot format into an action (unsupported by chrome-cdp)
        ...(meta.options.formats.includes("screenshot") ||
            meta.options.formats.includes("screenshot@fullPage")
            ? [
                {
                    type: "screenshot",
                    fullPage: meta.options.formats.includes("screenshot@fullPage"),
                },
            ]
            : []),
    ];
    const totalWait = actions.reduce((a, x) => (x.type === "wait" ? (x.milliseconds ?? 1000) + a : a), 0);
    const timeout = (timeToRun ?? 300000) + totalWait;
    const request = {
        url: meta.rewrittenUrl ?? meta.url,
        engine: "chrome-cdp",
        instantReturn: true,
        skipTlsVerification: meta.options.skipTlsVerification,
        headers: meta.options.headers,
        ...(actions.length > 0
            ? {
                actions,
            }
            : {}),
        priority: meta.internalOptions.priority,
        geolocation: meta.options.geolocation ?? meta.options.location,
        mobile: meta.options.mobile,
        timeout, // TODO: better timeout logic
        disableSmartWaitCache: meta.internalOptions.disableSmartWaitCache,
        mobileProxy: meta.featureFlags.has("stealthProxy"),
        saveScrapeResultToGCS: !meta.internalOptions.zeroDataRetention && meta.internalOptions.saveScrapeResultToGCS,
        zeroDataRetention: meta.internalOptions.zeroDataRetention,
    };
    let response = await performFireEngineScrape(meta, meta.logger.child({
        method: "scrapeURLWithFireEngineChromeCDP/callFireEngine",
        request,
    }), request, timeout, meta.mock, meta.internalOptions.abort ?? AbortSignal.timeout(timeout));
    if (meta.options.formats.includes("screenshot") ||
        meta.options.formats.includes("screenshot@fullPage")) {
        // meta.logger.debug(
        //   "Transforming screenshots from actions into screenshot field",
        //   { screenshots: response.screenshots },
        // );
        if (response.screenshots) {
            response.screenshot = response.screenshots.slice(-1)[0];
            response.screenshots = response.screenshots.slice(0, -1);
        }
        // meta.logger.debug("Screenshot transformation done", {
        //   screenshots: response.screenshots,
        //   screenshot: response.screenshot,
        // });
    }
    if (!response.url) {
        meta.logger.warn("Fire-engine did not return the response's URL", {
            response,
            sourceURL: meta.url,
        });
    }
    return {
        url: response.url ?? meta.url,
        html: response.content,
        error: response.pageError,
        statusCode: response.pageStatusCode,
        contentType: (Object.entries(response.responseHeaders ?? {}).find((x) => x[0].toLowerCase() === "content-type") ?? [])[1] ?? undefined,
        screenshot: response.screenshot,
        ...(actions.length > 0
            ? {
                actions: {
                    screenshots: response.screenshots ?? [],
                    scrapes: response.actionContent ?? [],
                    javascriptReturns: (response.actionResults ?? []).filter(x => x.type === "executeJavascript").map(x => JSON.parse(x.result.return)),
                    pdfs: (response.actionResults ?? []).filter(x => x.type === "pdf").map(x => x.result.link),
                },
            }
            : {}),
        proxyUsed: response.usedMobileProxy ? "stealth" : "basic",
    };
}
async function scrapeURLWithFireEnginePlaywright(meta, timeToRun) {
    const totalWait = meta.options.waitFor;
    const timeout = (timeToRun ?? 300000) + totalWait;
    const request = {
        url: meta.rewrittenUrl ?? meta.url,
        engine: "playwright",
        instantReturn: true,
        headers: meta.options.headers,
        priority: meta.internalOptions.priority,
        screenshot: meta.options.formats.includes("screenshot"),
        fullPageScreenshot: meta.options.formats.includes("screenshot@fullPage"),
        wait: meta.options.waitFor,
        geolocation: meta.options.geolocation ?? meta.options.location,
        blockAds: meta.options.blockAds,
        mobileProxy: meta.featureFlags.has("stealthProxy"),
        timeout,
        saveScrapeResultToGCS: !meta.internalOptions.zeroDataRetention && meta.internalOptions.saveScrapeResultToGCS,
        zeroDataRetention: meta.internalOptions.zeroDataRetention,
    };
    let response = await performFireEngineScrape(meta, meta.logger.child({
        method: "scrapeURLWithFireEngineChromeCDP/callFireEngine",
        request,
    }), request, timeout, meta.mock, meta.internalOptions.abort ?? AbortSignal.timeout(timeout));
    if (!response.url) {
        meta.logger.warn("Fire-engine did not return the response's URL", {
            response,
            sourceURL: meta.url,
        });
    }
    return {
        url: response.url ?? meta.url,
        html: response.content,
        error: response.pageError,
        statusCode: response.pageStatusCode,
        contentType: (Object.entries(response.responseHeaders ?? {}).find((x) => x[0].toLowerCase() === "content-type") ?? [])[1] ?? undefined,
        ...(response.screenshots !== undefined && response.screenshots.length > 0
            ? {
                screenshot: response.screenshots[0],
            }
            : {}),
        proxyUsed: response.usedMobileProxy ? "stealth" : "basic",
    };
}
async function scrapeURLWithFireEngineTLSClient(meta, timeToRun) {
    const timeout = timeToRun ?? 30000;
    const request = {
        url: meta.rewrittenUrl ?? meta.url,
        engine: "tlsclient",
        instantReturn: true,
        headers: meta.options.headers,
        priority: meta.internalOptions.priority,
        atsv: meta.internalOptions.atsv,
        geolocation: meta.options.geolocation ?? meta.options.location,
        disableJsDom: meta.internalOptions.v0DisableJsDom,
        mobileProxy: meta.featureFlags.has("stealthProxy"),
        timeout,
        saveScrapeResultToGCS: !meta.internalOptions.zeroDataRetention && meta.internalOptions.saveScrapeResultToGCS,
        zeroDataRetention: meta.internalOptions.zeroDataRetention,
    };
    let response = await performFireEngineScrape(meta, meta.logger.child({
        method: "scrapeURLWithFireEngineChromeCDP/callFireEngine",
        request,
    }), request, timeout, meta.mock, meta.internalOptions.abort ?? AbortSignal.timeout(timeout));
    if (!response.url) {
        meta.logger.warn("Fire-engine did not return the response's URL", {
            response,
            sourceURL: meta.url,
        });
    }
    return {
        url: response.url ?? meta.url,
        html: response.content,
        error: response.pageError,
        statusCode: response.pageStatusCode,
        contentType: (Object.entries(response.responseHeaders ?? {}).find((x) => x[0].toLowerCase() === "content-type") ?? [])[1] ?? undefined,
        proxyUsed: response.usedMobileProxy ? "stealth" : "basic",
    };
}
//# sourceMappingURL=index.js.map