"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationString = getNotificationString;
const types_1 = require("../../types");
// depending on the notification type, return the appropriate string
function getNotificationString(notificationType) {
    switch (notificationType) {
        case types_1.NotificationType.APPROACHING_LIMIT:
            return "Approaching the limit (80%)";
        case types_1.NotificationType.LIMIT_REACHED:
            return "Limit reached (100%)";
        case types_1.NotificationType.RATE_LIMIT_REACHED:
            return "Rate limit reached";
        case types_1.NotificationType.AUTO_RECHARGE_SUCCESS:
            return "Auto-recharge successful";
        case types_1.NotificationType.AUTO_RECHARGE_FAILED:
            return "Auto-recharge failed";
        case types_1.NotificationType.CONCURRENCY_LIMIT_REACHED:
            return "Concurrency limit reached";
        default:
            return "Unknown notification type";
    }
}
//# sourceMappingURL=notification_string.js.map