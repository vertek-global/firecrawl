"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnterpriseTeamCreatedAfterRateLimitChange = isEnterpriseTeamCreatedAfterRateLimitChange;
const supabase_1 = require("../supabase");
const RATE_LIMIT_CHANGE_NOTIFICATION_START_DATE = new Date("2025-03-12");
async function isEnterpriseTeamCreatedAfterRateLimitChange(team_id) {
    const { data, error } = (await supabase_1.supabase_service
        .from("subscriptions")
        .select("prices(products(is_enterprise))")
        .eq("status", "active")
        .eq("team_id", team_id)
        .gt("created", RATE_LIMIT_CHANGE_NOTIFICATION_START_DATE.toISOString()));
    if (error || !data) {
        // If there's an error or no subscription found, assume non-enterprise
        return false;
    }
    const isEnterprise = data.find((sub) => sub.prices?.products?.is_enterprise === true);
    return !!isEnterprise;
}
//# sourceMappingURL=enterprise-check.js.map