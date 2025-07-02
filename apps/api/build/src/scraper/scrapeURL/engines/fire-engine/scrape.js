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
exports.fireEngineURL = void 0;
exports.fireEngineScrape = fireEngineScrape;
const Sentry = __importStar(require("@sentry/node"));
const zod_1 = require("zod");
const fetch_1 = require("../../lib/fetch");
const schema = zod_1.z.object({
    jobId: zod_1.z.string(),
    processing: zod_1.z.boolean(),
});
exports.fireEngineURL = process.env.FIRE_ENGINE_BETA_URL ?? "<mock-fire-engine-url>";
async function fireEngineScrape(logger, request, mock, abort) {
    const scrapeRequest = await Sentry.startSpan({
        name: "fire-engine: Scrape",
        attributes: {
            url: request.url,
        },
    }, async (span) => {
        return await (0, fetch_1.robustFetch)({
            url: `${exports.fireEngineURL}/scrape`,
            method: "POST",
            headers: {
                ...(Sentry.isInitialized()
                    ? {
                        "sentry-trace": Sentry.spanToTraceHeader(span),
                        baggage: Sentry.spanToBaggageHeader(span),
                    }
                    : {}),
            },
            body: request,
            logger: logger.child({ method: "fireEngineScrape/robustFetch" }),
            schema,
            tryCount: 3,
            mock,
            abort,
        });
    });
    return scrapeRequest;
}
//# sourceMappingURL=scrape.js.map