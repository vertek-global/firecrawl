"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdjustedMaxDepth = getAdjustedMaxDepth;
exports.getURLDepth = getURLDepth;
function getAdjustedMaxDepth(url, maxCrawlDepth) {
    const baseURLDepth = getURLDepth(url);
    const adjustedMaxDepth = maxCrawlDepth + baseURLDepth;
    return adjustedMaxDepth;
}
function getURLDepth(url) {
    const pathSplits = new URL(url).pathname
        .split("/")
        .filter((x) => x !== "" && x !== "index.php" && x !== "index.html");
    return pathSplits.length;
}
//# sourceMappingURL=maxDepthUtils.js.map