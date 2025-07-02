"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenUsageController = tokenUsageController;
const auth_1 = require("../auth");
const logger_1 = require("../../lib/logger");
const types_1 = require("../../types");
async function tokenUsageController(req, res) {
    try {
        // If we already have the token usage info from auth, use it
        if (req.acuc) {
            res.json({
                success: true,
                data: {
                    remaining_tokens: req.acuc.remaining_credits,
                },
            });
            return;
        }
        // Otherwise fetch fresh data
        const chunk = await (0, auth_1.getACUCTeam)(req.auth.team_id, false, false, types_1.RateLimiterMode.Extract);
        if (!chunk) {
            res.status(404).json({
                success: false,
                error: "Could not find token usage information",
            });
            return;
        }
        res.json({
            success: true,
            data: {
                remaining_tokens: chunk.remaining_credits,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Error in token usage controller:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error while fetching token usage",
        });
    }
}
//# sourceMappingURL=token-usage.js.map