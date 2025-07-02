"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamIdSyncB = void 0;
const supabase_1 = require("../../services/supabase");
const logger_1 = require("../logger");
const withAuth_1 = require("../withAuth");
async function getTeamIdSyncBOriginal(teamId) {
    try {
        const { data, error } = await supabase_1.supabase_rr_service
            .from("eb-sync")
            .select("team_id")
            .eq("team_id", teamId)
            .limit(1);
        if (error) {
            throw new Error("Error getting team id (sync b)");
        }
        return data[0] ?? null;
    }
    catch (error) {
        logger_1.logger.error("Error getting team id (sync b)", error);
        return null;
    }
}
exports.getTeamIdSyncB = (0, withAuth_1.withAuth)(getTeamIdSyncBOriginal, null);
//# sourceMappingURL=team-id-sync.js.map