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
exports.fireEngineDelete = fireEngineDelete;
const Sentry = __importStar(require("@sentry/node"));
const fetch_1 = require("../../lib/fetch");
const scrape_1 = require("./scrape");
async function fireEngineDelete(logger, jobId, mock, abort) {
    await Sentry.startSpan({
        name: "fire-engine: Delete scrape",
        attributes: {
            jobId,
        },
    }, async (span) => {
        await (0, fetch_1.robustFetch)({
            url: `${scrape_1.fireEngineURL}/scrape/${jobId}`,
            method: "DELETE",
            headers: {
                ...(Sentry.isInitialized()
                    ? {
                        "sentry-trace": Sentry.spanToTraceHeader(span),
                        baggage: Sentry.spanToBaggageHeader(span),
                    }
                    : {}),
            },
            ignoreResponse: true,
            ignoreFailure: true,
            logger: logger.child({ method: "fireEngineDelete/robustFetch", jobId }),
            mock,
            abort,
        });
    });
    // We do not care whether this fails or not.
}
//# sourceMappingURL=delete.js.map