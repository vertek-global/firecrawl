"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyAuthController = void 0;
const auth_1 = require("../auth");
const redis_1 = require("../../../src/services/redis");
const logger_1 = require("../../lib/logger");
const keyAuthController = async (req, res) => {
    try {
        // make sure to authenticate user first, Bearer <token>
        const auth = await (0, auth_1.authenticateUser)(req, res);
        if (!auth.success) {
            return res.status(auth.status).json({ error: auth.error });
        }
        if (auth.chunk?.flags?.forceZDR) {
            return res.status(400).json({ error: "Your team has zero data retention enabled. This is not supported on the v0 API. Please update your code to use the v1 API." });
        }
        redis_1.redisEvictConnection.sadd("teams_using_v0", auth.team_id)
            .catch(error => logger_1.logger.error("Failed to add team to teams_using_v0", { error, team_id: auth.team_id }));
        // if success, return success: true
        return res.status(200).json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.keyAuthController = keyAuthController;
//# sourceMappingURL=keyAuth.js.map