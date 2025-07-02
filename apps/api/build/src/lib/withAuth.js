"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAuth = withAuth;
const logger_1 = require("./logger");
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
let warningCount = 0;
function withAuth(originalFunction, mockSuccess) {
    return async function (...args) {
        const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === "true";
        if (!useDbAuthentication) {
            if (warningCount < 5) {
                logger_1.logger.warn("You're bypassing authentication");
                warningCount++;
            }
            return { success: true, ...(mockSuccess || {}) };
        }
        else {
            return await originalFunction(...args);
        }
    };
}
//# sourceMappingURL=withAuth.js.map