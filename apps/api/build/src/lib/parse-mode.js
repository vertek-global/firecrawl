"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMode = parseMode;
function parseMode(mode) {
    switch (mode) {
        case "single_urls":
            return "single_urls";
        case "sitemap":
            return "sitemap";
        case "crawl":
            return "crawl";
        default:
            return "single_urls";
    }
}
//# sourceMappingURL=parse-mode.js.map