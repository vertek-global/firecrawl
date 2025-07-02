"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUrl = normalizeUrl;
exports.normalizeUrlOnlyHostname = normalizeUrlOnlyHostname;
function normalizeUrl(url) {
    url = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (url.endsWith("/")) {
        url = url.slice(0, -1);
    }
    return url;
}
function normalizeUrlOnlyHostname(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, "");
    }
    catch (error) {
        return url
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .split("/")[0];
    }
}
//# sourceMappingURL=canonical-url.js.map