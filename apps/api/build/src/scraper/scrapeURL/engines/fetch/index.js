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
exports.scrapeURLWithFetch = scrapeURLWithFetch;
const undici = __importStar(require("undici"));
const error_1 = require("../../error");
const specialtyHandler_1 = require("../utils/specialtyHandler");
const safeFetch_1 = require("../utils/safeFetch");
const mock_1 = require("../../lib/mock");
const util_1 = require("util");
async function scrapeURLWithFetch(meta, timeToRun) {
    const timeout = timeToRun ?? 300000;
    const mockOptions = {
        url: meta.rewrittenUrl ?? meta.url,
        // irrelevant
        method: "GET",
        ignoreResponse: false,
        ignoreFailure: false,
        tryCount: 1,
    };
    let response;
    if (meta.mock !== null) {
        const makeRequestTypeId = (request) => request.url + ";" + request.method;
        const thisId = makeRequestTypeId(mockOptions);
        const matchingMocks = meta.mock.requests
            .filter((x) => makeRequestTypeId(x.options) === thisId)
            .sort((a, b) => a.time - b.time);
        const nextI = meta.mock.tracker[thisId] ?? 0;
        meta.mock.tracker[thisId] = nextI + 1;
        if (!matchingMocks[nextI]) {
            throw new Error("Failed to mock request -- no mock targets found.");
        }
        response = {
            ...matchingMocks[nextI].result,
        };
    }
    else {
        try {
            const x = await Promise.race([
                undici.fetch(meta.rewrittenUrl ?? meta.url, {
                    dispatcher: await (0, safeFetch_1.makeSecureDispatcher)(meta.rewrittenUrl ?? meta.url),
                    redirect: "follow",
                    headers: meta.options.headers,
                    signal: meta.internalOptions.abort ?? AbortSignal.timeout(timeout),
                }),
                (async () => {
                    await new Promise((resolve) => setTimeout(() => resolve(null), timeout));
                    throw new error_1.TimeoutError("Fetch was unable to scrape the page before timing out", { cause: { timeout } });
                })(),
            ]);
            const buf = Buffer.from(await x.arrayBuffer());
            let text = buf.toString("utf8");
            const charset = (text.match(/<meta\b[^>]*charset\s*=\s*["']?([^"'\s\/>]+)/i) ?? [])[1];
            try {
                if (charset) {
                    text = new util_1.TextDecoder(charset.trim()).decode(buf);
                }
            }
            catch (error) {
                meta.logger.warn("Failed to re-parse with correct charset", { charset, error });
            }
            response = {
                url: x.url,
                body: text,
                status: x.status,
                headers: [...x.headers],
            };
            if (meta.mock === null) {
                await (0, mock_1.saveMock)(mockOptions, response);
            }
        }
        catch (error) {
            if (error instanceof TypeError &&
                error.cause instanceof safeFetch_1.InsecureConnectionError) {
                throw error.cause;
            }
            else {
                throw error;
            }
        }
    }
    await (0, specialtyHandler_1.specialtyScrapeCheck)(meta.logger.child({ method: "scrapeURLWithFetch/specialtyScrapeCheck" }), Object.fromEntries(response.headers));
    return {
        url: response.url,
        html: response.body,
        statusCode: response.status,
        contentType: (response.headers.find((x) => x[0].toLowerCase() === "content-type") ?? [])[1] ?? undefined,
        proxyUsed: "basic",
    };
}
//# sourceMappingURL=index.js.map