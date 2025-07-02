"use strict";
// This file is an exception to the "no supabase in scrapeURL" rule,
// and it makes me sad. - mogery
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadScreenshot = uploadScreenshot;
const supabase_1 = require("../../../services/supabase");
function uploadScreenshot(meta, document) {
    if (process.env.USE_DB_AUTHENTICATION === "true" &&
        document.screenshot !== undefined &&
        document.screenshot.startsWith("data:")) {
        meta.logger.debug("Uploading screenshot to Supabase...");
        const fileName = `screenshot-${crypto.randomUUID()}.png`;
        supabase_1.supabase_service.storage
            .from("media")
            .upload(fileName, Buffer.from(document.screenshot.split(",")[1], "base64"), {
            cacheControl: "3600",
            upsert: false,
            contentType: document.screenshot.split(":")[1].split(";")[0],
        });
        document.screenshot = `https://service.firecrawl.dev/storage/v1/object/public/media/${encodeURIComponent(fileName)}`;
    }
    return document;
}
//# sourceMappingURL=uploadScreenshot.js.map