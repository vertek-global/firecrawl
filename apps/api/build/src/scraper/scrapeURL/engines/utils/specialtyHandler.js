"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialtyScrapeCheck = specialtyScrapeCheck;
const error_1 = require("../../error");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const promises_1 = require("fs/promises");
async function feResToPdfPrefetch(logger, feRes) {
    if (!feRes?.file) {
        logger.warn("No file in pdf prefetch");
        return null;
    }
    const filePath = path_1.default.join(os_1.default.tmpdir(), `tempFile-${crypto.randomUUID()}.pdf`);
    await (0, promises_1.writeFile)(filePath, Buffer.from(feRes.file.content, "base64"));
    return {
        status: feRes.pageStatusCode,
        url: feRes.url,
        filePath,
        proxyUsed: feRes.usedMobileProxy ? "stealth" : "basic",
    };
}
async function specialtyScrapeCheck(logger, headers, feRes) {
    const contentType = (Object.entries(headers ?? {}).find((x) => x[0].toLowerCase() === "content-type") ?? [])[1];
    if (contentType === undefined) {
        logger.warn("Failed to check contentType -- was not present in headers", {
            headers,
        });
    }
    else if (contentType === "application/pdf" ||
        contentType.startsWith("application/pdf;")) {
        // .pdf
        throw new error_1.AddFeatureError(["pdf"], await feResToPdfPrefetch(logger, feRes));
    }
    else if (contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        contentType.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document;")) {
        // .docx
        throw new error_1.AddFeatureError(["docx"]);
    }
}
//# sourceMappingURL=specialtyHandler.js.map