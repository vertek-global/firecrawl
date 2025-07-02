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
exports.StillProcessingError = void 0;
exports.fireEngineCheckStatus = fireEngineCheckStatus;
const Sentry = __importStar(require("@sentry/node"));
const zod_1 = require("zod");
const fetch_1 = require("../../lib/fetch");
const error_1 = require("../../error");
const scrape_1 = require("./scrape");
const gcs_jobs_1 = require("../../../../lib/gcs-jobs");
const successSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    state: zod_1.z.literal("completed"),
    processing: zod_1.z.literal(false),
    // timeTaken: z.number(),
    content: zod_1.z.string(),
    url: zod_1.z.string().optional(),
    pageStatusCode: zod_1.z.number(),
    pageError: zod_1.z.string().optional(),
    // TODO: this needs to be non-optional, might need fixes on f-e side to ensure reliability
    responseHeaders: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    // timeTakenCookie: z.number().optional(),
    // timeTakenRequest: z.number().optional(),
    // legacy: playwright only
    screenshot: zod_1.z.string().optional(),
    // new: actions
    screenshots: zod_1.z.string().array().optional(),
    actionContent: zod_1.z
        .object({
        url: zod_1.z.string(),
        html: zod_1.z.string(),
    })
        .array()
        .optional(),
    actionResults: zod_1.z.union([
        zod_1.z.object({
            idx: zod_1.z.number(),
            type: zod_1.z.literal("screenshot"),
            result: zod_1.z.object({
                path: zod_1.z.string(),
            }),
        }),
        zod_1.z.object({
            idx: zod_1.z.number(),
            type: zod_1.z.literal("scrape"),
            result: zod_1.z.union([
                zod_1.z.object({
                    url: zod_1.z.string(),
                    html: zod_1.z.string(),
                }),
                zod_1.z.object({
                    url: zod_1.z.string(),
                    accessibility: zod_1.z.string(),
                }),
            ]),
        }),
        zod_1.z.object({
            idx: zod_1.z.number(),
            type: zod_1.z.literal("executeJavascript"),
            result: zod_1.z.object({
                return: zod_1.z.string(),
            }),
        }),
        zod_1.z.object({
            idx: zod_1.z.number(),
            type: zod_1.z.literal("pdf"),
            result: zod_1.z.object({
                link: zod_1.z.string(),
            }),
        }),
    ]).array().optional(),
    // chrome-cdp only -- file download handler
    file: zod_1.z
        .object({
        name: zod_1.z.string(),
        content: zod_1.z.string(),
    })
        .optional()
        .or(zod_1.z.null()),
    docUrl: zod_1.z.string().optional(),
    usedMobileProxy: zod_1.z.boolean().optional(),
});
const processingSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    state: zod_1.z.enum([
        "delayed",
        "active",
        "waiting",
        "waiting-children",
        "unknown",
        "prioritized",
    ]),
    processing: zod_1.z.boolean(),
});
const failedSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    state: zod_1.z.literal("failed"),
    processing: zod_1.z.literal(false),
    error: zod_1.z.string(),
});
class StillProcessingError extends Error {
    constructor(jobId) {
        super("Job is still under processing", { cause: { jobId } });
    }
}
exports.StillProcessingError = StillProcessingError;
async function fireEngineCheckStatus(meta, logger, jobId, mock, abort) {
    let status = await Sentry.startSpan({
        name: "fire-engine: Check status",
        attributes: {
            jobId,
        },
    }, async (span) => {
        return await (0, fetch_1.robustFetch)({
            url: `${scrape_1.fireEngineURL}/scrape/${jobId}`,
            method: "GET",
            logger: logger.child({ method: "fireEngineCheckStatus/robustFetch" }),
            headers: {
                ...(Sentry.isInitialized()
                    ? {
                        "sentry-trace": Sentry.spanToTraceHeader(span),
                        baggage: Sentry.spanToBaggageHeader(span),
                    }
                    : {}),
            },
            mock,
            abort,
        });
    });
    // Fire-engine now saves the content to GCS
    if (!status.content && status.docUrl) {
        const doc = await (0, gcs_jobs_1.getDocFromGCS)(status.docUrl.split('/').pop() ?? "");
        if (doc) {
            status = { ...status, ...doc };
            delete status.docUrl;
        }
    }
    const successParse = successSchema.safeParse(status);
    const processingParse = processingSchema.safeParse(status);
    const failedParse = failedSchema.safeParse(status);
    if (successParse.success) {
        logger.debug("Scrape succeeded!", { jobId });
        return successParse.data;
    }
    else if (processingParse.success) {
        throw new StillProcessingError(jobId);
    }
    else if (failedParse.success) {
        logger.debug("Scrape job failed", { status, jobId });
        if (typeof status.error === "string" &&
            status.error.includes("Chrome error: ")) {
            const code = status.error.split("Chrome error: ")[1];
            if (code.includes("ERR_CERT_") || code.includes("ERR_SSL_") || code.includes("ERR_BAD_SSL_")) {
                throw new error_1.SSLError(meta.options.skipTlsVerification);
            }
            else {
                throw new error_1.SiteError(code);
            }
        }
        else if (typeof status.error === "string" &&
            status.error.includes("Dns resolution error for hostname: ")) {
            throw new error_1.DNSResolutionError(status.error.split("Dns resolution error for hostname: ")[1]);
        }
        else if (typeof status.error === "string" &&
            status.error.includes("File size exceeds")) {
            throw new error_1.UnsupportedFileError("File size exceeds " + status.error.split("File size exceeds ")[1]);
        }
        else if (typeof status.error === "string" &&
            status.error.includes("failed to finish without timing out")) {
            logger.warn("CDP timed out while loading the page", { status, jobId });
            throw new error_1.FEPageLoadFailed();
        }
        else if (typeof status.error === "string" &&
            // TODO: improve this later
            (status.error.includes("Element") || status.error.includes("Javascript execution failed"))) {
            throw new error_1.ActionError(status.error.split("Error: ")[1]);
        }
        else {
            throw new error_1.EngineError("Scrape job failed", {
                cause: {
                    status,
                    jobId,
                },
            });
        }
    }
    else {
        logger.debug("Check status returned response not matched by any schema", {
            status,
            jobId,
        });
        throw new Error("Check status returned response not matched by any schema", {
            cause: {
                status,
                jobId,
            },
        });
    }
}
//# sourceMappingURL=checkStatus.js.map