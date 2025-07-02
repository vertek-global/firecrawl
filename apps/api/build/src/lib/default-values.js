"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultExtractorOptions = exports.defaultCrawlPageOptions = exports.defaultCrawlerOptions = exports.defaultPageOptions = exports.defaultTimeout = exports.defaultOrigin = void 0;
exports.defaultOrigin = "api";
exports.defaultTimeout = 60000; // 60 seconds
exports.defaultPageOptions = {
    onlyMainContent: false,
    includeHtml: false,
    waitFor: 0,
    screenshot: false,
    fullPageScreenshot: false,
    parsePDF: true,
};
exports.defaultCrawlerOptions = {
    allowBackwardCrawling: false,
    limit: 10000,
};
exports.defaultCrawlPageOptions = {
    onlyMainContent: false,
    includeHtml: false,
    removeTags: [],
    parsePDF: true,
};
exports.defaultExtractorOptions = {
    mode: "markdown",
};
//# sourceMappingURL=default-values.js.map