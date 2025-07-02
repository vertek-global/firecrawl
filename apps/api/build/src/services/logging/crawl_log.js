"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCrawl = logCrawl;
const supabase_1 = require("../supabase");
const logger_1 = require("../../../src/lib/logger");
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
async function logCrawl(job_id, team_id) {
    const useDbAuthentication = process.env.USE_DB_AUTHENTICATION === "true";
    if (useDbAuthentication) {
        try {
            const { data, error } = await supabase_1.supabase_service
                .from("bulljobs_teams")
                .insert([
                {
                    job_id: job_id,
                    team_id: team_id,
                },
            ]);
        }
        catch (error) {
            logger_1.logger.error(`Error logging crawl job to supabase:\n${error}`);
        }
    }
}
//# sourceMappingURL=crawl_log.js.map