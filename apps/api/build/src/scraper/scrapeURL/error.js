"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEPageLoadFailed = exports.PDFPrefetchFailed = exports.ZDRViolationError = exports.IndexMissError = exports.DNSResolutionError = exports.PDFInsufficientTimeError = exports.PDFAntibotError = exports.UnsupportedFileError = exports.ActionError = exports.SiteError = exports.SSLError = exports.RemoveFeatureError = exports.AddFeatureError = exports.NoEnginesLeftError = exports.TimeoutError = exports.EngineError = void 0;
class EngineError extends Error {
    constructor(message, options) {
        super(message, options);
    }
}
exports.EngineError = EngineError;
class TimeoutError extends Error {
    constructor(message, options) {
        super(message, options);
    }
}
exports.TimeoutError = TimeoutError;
class NoEnginesLeftError extends Error {
    fallbackList;
    results;
    constructor(fallbackList, results) {
        super("All scraping engines failed! -- Double check the URL to make sure it's not broken. If the issue persists, contact us at help@firecrawl.com.");
        this.fallbackList = fallbackList;
        this.results = results;
    }
}
exports.NoEnginesLeftError = NoEnginesLeftError;
class AddFeatureError extends Error {
    featureFlags;
    pdfPrefetch;
    constructor(featureFlags, pdfPrefetch) {
        super("New feature flags have been discovered: " + featureFlags.join(", "));
        this.featureFlags = featureFlags;
        this.pdfPrefetch = pdfPrefetch;
    }
}
exports.AddFeatureError = AddFeatureError;
class RemoveFeatureError extends Error {
    featureFlags;
    constructor(featureFlags) {
        super("Incorrect feature flags have been discovered: " +
            featureFlags.join(", "));
        this.featureFlags = featureFlags;
    }
}
exports.RemoveFeatureError = RemoveFeatureError;
class SSLError extends Error {
    constructor(skipTlsVerification) {
        super("An SSL error occurred while scraping the URL. "
            + (skipTlsVerification
                ? "Since you have `skipTlsVerification` enabled, this means that the TLS configuration of the target site is completely broken. Try scraping the plain HTTP version of the page."
                : "If you're not inputting any sensitive data, try scraping with `skipTlsVerification: true`."));
    }
}
exports.SSLError = SSLError;
class SiteError extends Error {
    code;
    constructor(code) {
        super("Specified URL is failing to load in the browser. Error code: " + code);
        this.code = code;
    }
}
exports.SiteError = SiteError;
class ActionError extends Error {
    code;
    constructor(code) {
        super("Action(s) failed to complete. Error code: " + code);
        this.code = code;
    }
}
exports.ActionError = ActionError;
class UnsupportedFileError extends Error {
    reason;
    constructor(reason) {
        super("Scrape resulted in unsupported file: " + reason);
        this.reason = reason;
    }
}
exports.UnsupportedFileError = UnsupportedFileError;
class PDFAntibotError extends Error {
    constructor() {
        super("PDF scrape was prevented by anti-bot");
    }
}
exports.PDFAntibotError = PDFAntibotError;
class PDFInsufficientTimeError extends Error {
    constructor(pageCount, minTimeout) {
        super(`Insufficient time to process PDF of ${pageCount} pages. Please increase the timeout parameter in your scrape request to at least ${minTimeout}ms.`);
    }
}
exports.PDFInsufficientTimeError = PDFInsufficientTimeError;
class DNSResolutionError extends Error {
    constructor(hostname) {
        super(`DNS resolution failed for hostname: ${hostname}. Please check if the domain is valid and accessible.`);
    }
}
exports.DNSResolutionError = DNSResolutionError;
class IndexMissError extends Error {
    constructor() {
        super("Index doesn't have the page we're looking for");
    }
}
exports.IndexMissError = IndexMissError;
class ZDRViolationError extends Error {
    constructor(feature) {
        super(`${feature} is not supported when using zeroDataRetention. Please contact support@firecrawl.com to unblock this feature.`);
    }
}
exports.ZDRViolationError = ZDRViolationError;
class PDFPrefetchFailed extends Error {
    constructor() {
        super("Failed to prefetch PDF that is protected by anti-bot. Please contact help@firecrawl.com");
    }
}
exports.PDFPrefetchFailed = PDFPrefetchFailed;
class FEPageLoadFailed extends Error {
    constructor() {
        super("The page failed to load with the specified timeout. Please increase the timeout parameter in your request.");
    }
}
exports.FEPageLoadFailed = FEPageLoadFailed;
//# sourceMappingURL=error.js.map