"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeURLWithPlaywright = scrapeURLWithPlaywright;
const zod_1 = require("zod");
const error_1 = require("../../error");
const fetch_1 = require("../../lib/fetch");
const html_transformer_1 = require("../../../../lib/html-transformer");
async function scrapeURLWithPlaywright(meta, timeToRun) {
    const timeout = (timeToRun ?? 300000) + meta.options.waitFor;
    const response = await Promise.race([
        await (0, fetch_1.robustFetch)({
            url: process.env.PLAYWRIGHT_MICROSERVICE_URL,
            headers: {
                "Content-Type": "application/json",
            },
            body: {
                url: meta.rewrittenUrl ?? meta.url,
                wait_after_load: meta.options.waitFor,
                timeout,
                headers: meta.options.headers,
            },
            method: "POST",
            logger: meta.logger.child("scrapeURLWithPlaywright/robustFetch"),
            schema: zod_1.z.object({
                content: zod_1.z.string(),
                pageStatusCode: zod_1.z.number(),
                pageError: zod_1.z.string().optional(),
                contentType: zod_1.z.string().optional(),
            }),
            mock: meta.mock,
            abort: AbortSignal.timeout(timeout),
        }),
        (async () => {
            await new Promise((resolve) => setTimeout(() => resolve(null), timeout));
            throw new error_1.TimeoutError("Playwright was unable to scrape the page before timing out", { cause: { timeout } });
        })(),
    ]);
    if (response.contentType?.includes("application/json")) {
        response.content = await (0, html_transformer_1.getInnerJSON)(response.content);
    }
    return {
        url: meta.rewrittenUrl ?? meta.url, // TODO: impove redirect following
        html: response.content,
        statusCode: response.pageStatusCode,
        error: response.pageError,
        contentType: response.contentType,
        proxyUsed: "basic",
    };
}
//# sourceMappingURL=index.js.map