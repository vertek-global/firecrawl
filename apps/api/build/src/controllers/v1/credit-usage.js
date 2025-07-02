"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.creditUsageController = creditUsageController;
const auth_1 = require("../auth");
const logger_1 = require("../../lib/logger");
const types_1 = require("../../types");
async function creditUsageController(req, res) {
    try {
        // If we already have the credit usage info from auth, use it
        if (req.acuc) {
            res.json({
                success: true,
                data: {
                    remaining_credits: req.acuc.remaining_credits,
                },
            });
            return;
        }
        // Otherwise fetch fresh data
        const chunk = await (0, auth_1.getACUCTeam)(req.auth.team_id, false, false, types_1.RateLimiterMode.Scrape);
        if (!chunk) {
            res.status(404).json({
                success: false,
                error: "Could not find credit usage information",
            });
            return;
        }
        res.json({
            success: true,
            data: {
                remaining_credits: chunk.remaining_credits,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Error in credit usage controller:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error while fetching credit usage",
        });
    }
}
//# sourceMappingURL=credit-usage.js.map