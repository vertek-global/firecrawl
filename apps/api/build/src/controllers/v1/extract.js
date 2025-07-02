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
exports.oldExtract = oldExtract;
exports.extractController = extractController;
const types_1 = require("./types");
const queue_service_1 = require("../../services/queue-service");
const Sentry = __importStar(require("@sentry/node"));
const extract_redis_1 = require("../../lib/extract/extract-redis");
const team_id_sync_1 = require("../../lib/extract/team-id-sync");
const extraction_service_1 = require("../../lib/extract/extraction-service");
const extraction_service_f0_1 = require("../../lib/extract/fire-0/extraction-service-f0");
const strings_1 = require("../../lib/strings");
const blocklist_1 = require("../../scraper/WebScraper/utils/blocklist");
const logger_1 = require("../../lib/logger");
async function oldExtract(req, res, extractId) {
    // Means that are in the non-queue system
    // TODO: Remove this once all teams have transitioned to the new system
    try {
        let result;
        const model = req.body.agent?.model;
        if (req.body.agent && model && model.toLowerCase().includes("fire-1")) {
            result = await (0, extraction_service_1.performExtraction)(extractId, {
                request: req.body,
                teamId: req.auth.team_id,
                subId: req.acuc?.sub_id ?? undefined,
            });
        }
        else {
            result = await (0, extraction_service_f0_1.performExtraction_F0)(extractId, {
                request: req.body,
                teamId: req.auth.team_id,
                subId: req.acuc?.sub_id ?? undefined,
            });
        }
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
/**
 * Extracts data from the provided URLs based on the request parameters.
 * Currently in beta.
 * @param req - The request object containing authentication and extraction details.
 * @param res - The response object to send the extraction results.
 * @returns A promise that resolves when the extraction process is complete.
 */
async function extractController(req, res) {
    const selfHosted = process.env.USE_DB_AUTHENTICATION !== "true";
    const originalRequest = { ...req.body };
    req.body = types_1.extractRequestSchema.parse(req.body);
    if (req.acuc?.flags?.forceZDR) {
        return res.status(400).json({ success: false, error: "Your team has zero data retention enabled. This is not supported on extract. Please contact support@firecrawl.com to unblock this feature." });
    }
    const invalidURLs = req.body.urls?.filter((url) => (0, blocklist_1.isUrlBlocked)(url, req.acuc?.flags ?? null)) ?? [];
    if (invalidURLs.length > 0 && !req.body.ignoreInvalidURLs) {
        if (!res.headersSent) {
            return res.status(403).json({
                success: false,
                error: strings_1.BLOCKLISTED_URL_MESSAGE,
            });
        }
    }
    const extractId = crypto.randomUUID();
    logger_1.logger.info("Extract starting...", {
        request: req.body,
        originalRequest,
        teamId: req.auth.team_id,
        team_id: req.auth.team_id,
        subId: req.acuc?.sub_id,
        extractId,
        zeroDataRetention: req.acuc?.flags?.forceZDR,
    });
    const jobData = {
        request: req.body,
        teamId: req.auth.team_id,
        subId: req.acuc?.sub_id,
        extractId,
        agent: req.body.agent,
    };
    if ((await (0, team_id_sync_1.getTeamIdSyncB)(req.auth.team_id)) &&
        req.body.origin !== "api-sdk" &&
        req.body.origin !== "website" &&
        !req.body.origin.startsWith("python-sdk@") &&
        !req.body.origin.startsWith("js-sdk@")) {
        return await oldExtract(req, res, extractId);
    }
    await (0, extract_redis_1.saveExtract)(extractId, {
        id: extractId,
        team_id: req.auth.team_id,
        createdAt: Date.now(),
        status: "processing",
        showSteps: req.body.__experimental_streamSteps,
        showLLMUsage: req.body.__experimental_llmUsage,
        showSources: req.body.__experimental_showSources || req.body.showSources,
        showCostTracking: req.body.__experimental_showCostTracking,
        zeroDataRetention: req.acuc?.flags?.forceZDR,
    });
    if (Sentry.isInitialized()) {
        const size = JSON.stringify(jobData).length;
        await Sentry.startSpan({
            name: "Add extract job",
            op: "queue.publish",
            attributes: {
                "messaging.message.id": extractId,
                "messaging.destination.name": (0, queue_service_1.getExtractQueue)().name,
                "messaging.message.body.size": size,
            },
        }, async (span) => {
            await (0, queue_service_1.getExtractQueue)().add(extractId, {
                ...jobData,
                sentry: {
                    trace: Sentry.spanToTraceHeader(span),
                    baggage: Sentry.spanToBaggageHeader(span),
                    size,
                },
            }, { jobId: extractId });
        });
    }
    else {
        await (0, queue_service_1.getExtractQueue)().add(extractId, jobData, {
            jobId: extractId,
        });
    }
    return res.status(200).json({
        success: true,
        id: extractId,
        urlTrace: [],
        ...(invalidURLs.length > 0 && req.body.ignoreInvalidURLs ? {
            invalidURLs,
        } : {}),
    });
}
//# sourceMappingURL=extract.js.map