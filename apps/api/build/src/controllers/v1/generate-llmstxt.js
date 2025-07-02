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
exports.generateLLMsTextController = generateLLMsTextController;
const types_1 = require("./types");
const queue_service_1 = require("../../services/queue-service");
const Sentry = __importStar(require("@sentry/node"));
const generate_llmstxt_redis_1 = require("../../lib/generate-llmstxt/generate-llmstxt-redis");
/**
 * Initiates a text generation job based on the provided URL.
 * @param req - The request object containing authentication and generation parameters.
 * @param res - The response object to send the generation job ID.
 * @returns A promise that resolves when the generation job is queued.
 */
async function generateLLMsTextController(req, res) {
    if (req.acuc?.flags?.forceZDR) {
        return res.status(400).json({ success: false, error: "Your team has zero data retention enabled. This is not supported on llmstxt. Please contact support@firecrawl.com to unblock this feature." });
    }
    req.body = types_1.generateLLMsTextRequestSchema.parse(req.body);
    const generationId = crypto.randomUUID();
    const jobData = {
        request: req.body,
        teamId: req.auth.team_id,
        subId: req.acuc?.sub_id,
        generationId,
    };
    await (0, generate_llmstxt_redis_1.saveGeneratedLlmsTxt)(generationId, {
        id: generationId,
        team_id: req.auth.team_id,
        createdAt: Date.now(),
        status: "processing",
        url: req.body.url,
        maxUrls: req.body.maxUrls,
        showFullText: req.body.showFullText,
        cache: req.body.cache,
        generatedText: "",
        fullText: "",
    });
    if (Sentry.isInitialized()) {
        const size = JSON.stringify(jobData).length;
        await Sentry.startSpan({
            name: "Add LLMstxt generation job",
            op: "queue.publish",
            attributes: {
                "messaging.message.id": generationId,
                "messaging.destination.name": (0, queue_service_1.getGenerateLlmsTxtQueue)().name,
                "messaging.message.body.size": size,
            },
        }, async (span) => {
            await (0, queue_service_1.getGenerateLlmsTxtQueue)().add(generationId, {
                ...jobData,
                sentry: {
                    trace: Sentry.spanToTraceHeader(span),
                    baggage: Sentry.spanToBaggageHeader(span),
                    size,
                },
            }, { jobId: generationId });
        });
    }
    else {
        await (0, queue_service_1.getGenerateLlmsTxtQueue)().add(generationId, jobData, {
            jobId: generationId,
        });
    }
    return res.status(200).json({
        success: true,
        id: generationId,
    });
}
//# sourceMappingURL=generate-llmstxt.js.map