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
exports.deepResearchRequestSchema = void 0;
exports.deepResearchController = deepResearchController;
const types_1 = require("./types");
const queue_service_1 = require("../../services/queue-service");
const Sentry = __importStar(require("@sentry/node"));
const deep_research_redis_1 = require("../../lib/deep-research/deep-research-redis");
const zod_1 = require("zod");
exports.deepResearchRequestSchema = zod_1.z.object({
    query: zod_1.z.string().describe('The query or topic to search for').optional(),
    maxDepth: zod_1.z.number().min(1).max(12).default(7).describe('Maximum depth of research iterations'),
    maxUrls: zod_1.z.number().min(1).max(1000).default(20).describe('Maximum number of URLs to analyze'),
    timeLimit: zod_1.z.number().min(30).max(600).default(300).describe('Time limit in seconds'),
    analysisPrompt: zod_1.z.string().describe('The prompt to use for the final analysis').optional(),
    systemPrompt: zod_1.z.string().describe('The system prompt to use for the research agent').optional(),
    formats: zod_1.z.array(zod_1.z.enum(['markdown', 'json'])).default(['markdown']),
    // @deprecated Use query instead
    topic: zod_1.z.string().describe('The topic or question to research').optional(),
    jsonOptions: types_1.extractOptions.optional(),
}).refine(data => data.query || data.topic, {
    message: "Either query or topic must be provided"
}).refine((obj) => {
    const hasJsonFormat = obj.formats?.includes("json");
    const hasJsonOptions = obj.jsonOptions !== undefined;
    return (hasJsonFormat && hasJsonOptions) || (!hasJsonFormat && !hasJsonOptions);
}, {
    message: "When 'json' format is specified, jsonOptions must be provided, and vice versa"
}).transform(data => ({
    ...data,
    query: data.topic || data.query // Use topic as query if provided
}));
/**
 * Initiates a deep research job based on the provided topic.
 * @param req - The request object containing authentication and research parameters.
 * @param res - The response object to send the research job ID.
 * @returns A promise that resolves when the research job is queued.
 */
async function deepResearchController(req, res) {
    if (req.acuc?.flags?.forceZDR) {
        return res.status(400).json({ success: false, error: "Your team has zero data retention enabled. This is not supported on deep research. Please contact support@firecrawl.com to unblock this feature." });
    }
    req.body = exports.deepResearchRequestSchema.parse(req.body);
    const researchId = crypto.randomUUID();
    const jobData = {
        request: req.body,
        teamId: req.auth.team_id,
        subId: req.acuc?.sub_id,
        researchId,
    };
    await (0, deep_research_redis_1.saveDeepResearch)(researchId, {
        id: researchId,
        team_id: req.auth.team_id,
        createdAt: Date.now(),
        status: "processing",
        currentDepth: 0,
        maxDepth: req.body.maxDepth,
        completedSteps: 0,
        totalExpectedSteps: req.body.maxDepth * 5, // 5 steps per depth level
        findings: [],
        sources: [],
        activities: [],
        summaries: [],
    });
    if (Sentry.isInitialized()) {
        const size = JSON.stringify(jobData).length;
        await Sentry.startSpan({
            name: "Add deep research job",
            op: "queue.publish",
            attributes: {
                "messaging.message.id": researchId,
                "messaging.destination.name": (0, queue_service_1.getDeepResearchQueue)().name,
                "messaging.message.body.size": size,
            },
        }, async (span) => {
            await (0, queue_service_1.getDeepResearchQueue)().add(researchId, {
                ...jobData,
                sentry: {
                    trace: Sentry.spanToTraceHeader(span),
                    baggage: Sentry.spanToBaggageHeader(span),
                    size,
                },
            }, { jobId: researchId });
        });
    }
    else {
        await (0, queue_service_1.getDeepResearchQueue)().add(researchId, jobData, {
            jobId: researchId,
        });
    }
    return res.status(200).json({
        success: true,
        id: researchId,
    });
}
//# sourceMappingURL=deep-research.js.map