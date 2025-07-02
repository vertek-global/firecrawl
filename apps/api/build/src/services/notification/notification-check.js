"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldSendConcurrencyLimitNotification = shouldSendConcurrencyLimitNotification;
const enterprise_check_1 = require("../subscription/enterprise-check");
async function shouldSendConcurrencyLimitNotification(team_id) {
    const isEnterprise = await (0, enterprise_check_1.isEnterpriseTeamCreatedAfterRateLimitChange)(team_id);
    return !isEnterprise;
}
//# sourceMappingURL=notification-check.js.map