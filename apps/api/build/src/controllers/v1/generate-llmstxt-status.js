"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLLMsTextStatusController = generateLLMsTextStatusController;
const generate_llmstxt_redis_1 = require("../../lib/generate-llmstxt/generate-llmstxt-redis");
async function generateLLMsTextStatusController(req, res) {
    const generation = await (0, generate_llmstxt_redis_1.getGeneratedLlmsTxt)(req.params.jobId);
    const showFullText = generation?.showFullText ?? false;
    if (!generation) {
        return res.status(404).json({
            success: false,
            error: "llmsTxt generation job not found",
        });
    }
    let data = null;
    if (showFullText) {
        data = {
            llmstxt: generation.generatedText,
            llmsfulltxt: generation.fullText,
        };
    }
    else {
        data = {
            llmstxt: generation.generatedText,
        };
    }
    return res.status(200).json({
        success: generation.status === "failed" ? false : true,
        data: data,
        status: generation.status,
        error: generation?.error ?? undefined,
        expiresAt: (await (0, generate_llmstxt_redis_1.getGeneratedLlmsTxtExpiry)(req.params.jobId)).toISOString(),
    });
}
//# sourceMappingURL=generate-llmstxt-status.js.map