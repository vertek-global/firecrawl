"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueCredits = issueCredits;
const logger_1 = require("../../lib/logger");
const supabase_1 = require("../supabase");
async function issueCredits(team_id, credits) {
    // Add an entry to supabase coupons
    const { error } = await supabase_1.supabase_service.from("coupons").insert({
        team_id: team_id,
        credits: credits,
        status: "active",
        // indicates that this coupon was issued from auto recharge
        from_auto_recharge: true,
        initial_credits: credits,
    });
    if (error) {
        logger_1.logger.error(`Error adding coupon: ${error}`);
        return false;
    }
    return true;
}
//# sourceMappingURL=issue_credits.js.map