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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapePDF = scrapePDF;
const marked = __importStar(require("marked"));
const fetch_1 = require("../../lib/fetch");
const zod_1 = require("zod");
const Sentry = __importStar(require("@sentry/node"));
const escape_html_1 = __importDefault(require("escape-html"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const downloadFile_1 = require("../utils/downloadFile");
const error_1 = require("../../error");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const pdf_parser_1 = require("../../../../lib/pdf-parser");
const gcs_pdf_cache_1 = require("../../../../lib/gcs-pdf-cache");
const MAX_FILE_SIZE = 19 * 1024 * 1024; // 19MB
const MILLISECONDS_PER_PAGE = 150;
async function scrapePDFWithRunPodMU(meta, tempFilePath, timeToRun, base64Content) {
    meta.logger.debug("Processing PDF document with RunPod MU", {
        tempFilePath,
    });
    const preCacheCheckStartTime = Date.now();
    try {
        const cachedResult = await (0, gcs_pdf_cache_1.getPdfResultFromCache)(base64Content);
        if (cachedResult) {
            meta.logger.info("Using cached RunPod MU result for PDF", {
                tempFilePath,
            });
            return cachedResult;
        }
    }
    catch (error) {
        meta.logger.warn("Error checking PDF cache, proceeding with RunPod MU", {
            error,
            tempFilePath,
        });
    }
    const timeout = timeToRun
        ? timeToRun - (Date.now() - preCacheCheckStartTime)
        : undefined;
    if (timeout && timeout < 0) {
        throw new error_1.TimeoutError("MU PDF parser already timed out before call");
    }
    const abort = timeout ? AbortSignal.timeout(timeout) : undefined;
    const podStart = await (0, fetch_1.robustFetch)({
        url: "https://api.runpod.ai/v2/" + process.env.RUNPOD_MUV2_POD_ID + "/runsync",
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RUNPOD_MU_API_KEY}`,
        },
        body: {
            input: {
                file_content: base64Content,
                filename: node_path_1.default.basename(tempFilePath) + ".pdf",
                timeout,
                created_at: Date.now(),
            },
        },
        logger: meta.logger.child({
            method: "scrapePDFWithRunPodMU/runsync/robustFetch",
        }),
        schema: zod_1.z.object({
            id: zod_1.z.string(),
            status: zod_1.z.string(),
            output: zod_1.z
                .object({
                markdown: zod_1.z.string(),
            })
                .optional(),
        }),
        mock: meta.mock,
        abort,
    });
    let status = podStart.status;
    let result = podStart.output;
    if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
        do {
            abort?.throwIfAborted();
            await new Promise((resolve) => setTimeout(resolve, 2500));
            abort?.throwIfAborted();
            const podStatus = await (0, fetch_1.robustFetch)({
                url: `https://api.runpod.ai/v2/${process.env.RUNPOD_MU_POD_ID}/status/${podStart.id}`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${process.env.RUNPOD_MU_API_KEY}`,
                },
                logger: meta.logger.child({
                    method: "scrapePDFWithRunPodMU/status/robustFetch",
                }),
                schema: zod_1.z.object({
                    status: zod_1.z.string(),
                    output: zod_1.z
                        .object({
                        markdown: zod_1.z.string(),
                    })
                        .optional(),
                }),
                mock: meta.mock,
                abort,
            });
            status = podStatus.status;
            result = podStatus.output;
        } while (status !== "COMPLETED" && status !== "FAILED");
    }
    if (status === "FAILED") {
        throw new Error("RunPod MU failed to parse PDF");
    }
    if (!result) {
        throw new Error("RunPod MU returned no result");
    }
    const processorResult = {
        markdown: result.markdown,
        html: await marked.parse(result.markdown, { async: true }),
    };
    if (!meta.internalOptions.zeroDataRetention) {
        try {
            await (0, gcs_pdf_cache_1.savePdfResultToCache)(base64Content, processorResult);
        }
        catch (error) {
            meta.logger.warn("Error saving PDF to cache", {
                error,
                tempFilePath,
            });
        }
    }
    return processorResult;
}
async function scrapePDFWithParsePDF(meta, tempFilePath) {
    meta.logger.debug("Processing PDF document with parse-pdf", { tempFilePath });
    const result = await (0, pdf_parse_1.default)(await (0, promises_1.readFile)(tempFilePath));
    const escaped = (0, escape_html_1.default)(result.text);
    return {
        markdown: escaped,
        html: escaped,
    };
}
async function scrapePDF(meta, timeToRun) {
    const startTime = Date.now();
    if (!meta.options.parsePDF) {
        if (meta.pdfPrefetch !== undefined && meta.pdfPrefetch !== null) {
            const content = (await (0, promises_1.readFile)(meta.pdfPrefetch.filePath)).toString("base64");
            return {
                url: meta.pdfPrefetch.url ?? meta.rewrittenUrl ?? meta.url,
                statusCode: meta.pdfPrefetch.status,
                html: content,
                markdown: content,
                proxyUsed: meta.pdfPrefetch.proxyUsed,
            };
        }
        else {
            const file = await (0, downloadFile_1.fetchFileToBuffer)(meta.rewrittenUrl ?? meta.url, {
                headers: meta.options.headers,
            });
            const ct = file.response.headers.get("Content-Type");
            if (ct && !ct.includes("application/pdf")) {
                // if downloaded file wasn't a PDF
                if (meta.pdfPrefetch === undefined) {
                    throw new error_1.PDFAntibotError();
                }
                else {
                    throw new error_1.PDFPrefetchFailed();
                }
            }
            const content = file.buffer.toString("base64");
            return {
                url: file.response.url,
                statusCode: file.response.status,
                html: content,
                markdown: content,
                proxyUsed: "basic",
            };
        }
    }
    const { response, tempFilePath } = meta.pdfPrefetch !== undefined && meta.pdfPrefetch !== null
        ? { response: meta.pdfPrefetch, tempFilePath: meta.pdfPrefetch.filePath }
        : await (0, downloadFile_1.downloadFile)(meta.id, meta.rewrittenUrl ?? meta.url, {
            headers: meta.options.headers,
        });
    if (response.headers) {
        // if downloadFile was used
        const r = response;
        const ct = r.headers.get("Content-Type");
        if (ct && !ct.includes("application/pdf")) {
            // if downloaded file wasn't a PDF
            if (meta.pdfPrefetch === undefined) {
                throw new error_1.PDFAntibotError();
            }
            else {
                throw new error_1.PDFPrefetchFailed();
            }
        }
    }
    const pageCount = await (0, pdf_parser_1.getPageCount)(tempFilePath);
    if (pageCount * MILLISECONDS_PER_PAGE > (timeToRun ?? Infinity)) {
        throw new error_1.PDFInsufficientTimeError(pageCount, pageCount * MILLISECONDS_PER_PAGE + 5000);
    }
    let result = null;
    const base64Content = (await (0, promises_1.readFile)(tempFilePath)).toString("base64");
    // First try RunPod MU if conditions are met
    if (base64Content.length < MAX_FILE_SIZE &&
        process.env.RUNPOD_MU_API_KEY &&
        process.env.RUNPOD_MU_POD_ID) {
        try {
            result = await scrapePDFWithRunPodMU({
                ...meta,
                logger: meta.logger.child({
                    method: "scrapePDF/scrapePDFWithRunPodMU",
                }),
            }, tempFilePath, timeToRun ? timeToRun - (Date.now() - startTime) : undefined, base64Content);
        }
        catch (error) {
            if (error instanceof error_1.RemoveFeatureError ||
                error instanceof error_1.TimeoutError) {
                throw error;
            }
            else if ((error instanceof Error && error.name === "TimeoutError") ||
                (error instanceof Error &&
                    error.message === "Request failed" &&
                    error.cause &&
                    error.cause instanceof Error &&
                    error.cause.name === "TimeoutError")) {
                throw new error_1.TimeoutError("PDF parsing timed out, please increase the timeout parameter in your scrape request");
            }
            meta.logger.warn("RunPod MU failed to parse PDF (could be due to timeout) -- falling back to parse-pdf", { error });
            Sentry.captureException(error);
        }
    }
    // If RunPod MU failed or wasn't attempted, use PdfParse
    if (!result) {
        result = await scrapePDFWithParsePDF({
            ...meta,
            logger: meta.logger.child({
                method: "scrapePDF/scrapePDFWithParsePDF",
            }),
        }, tempFilePath);
    }
    await (0, promises_1.unlink)(tempFilePath);
    return {
        url: response.url ?? meta.rewrittenUrl ?? meta.url,
        statusCode: response.status,
        html: result?.html ?? "",
        markdown: result?.markdown ?? "",
        numPages: pageCount,
        proxyUsed: "basic",
    };
}
//# sourceMappingURL=index.js.map