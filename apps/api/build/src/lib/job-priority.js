"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addJobPriority = addJobPriority;
exports.deleteJobPriority = deleteJobPriority;
exports.getJobPriority = getJobPriority;
const types_1 = require("../types");
const auth_1 = require("../controllers/auth");
const redis_1 = require("../services/redis");
const logger_1 = require("./logger");
const SET_KEY_PREFIX = "limit_team_id:";
async function addJobPriority(team_id, job_id) {
    try {
        const setKey = SET_KEY_PREFIX + team_id;
        // Add scrape job id to the set
        await redis_1.redisEvictConnection.sadd(setKey, job_id);
        // This approach will reset the expiration time to 60 seconds every time a new job is added to the set.
        await redis_1.redisEvictConnection.expire(setKey, 60);
    }
    catch (e) {
        logger_1.logger.error(`Add job priority (sadd) failed: ${team_id}, ${job_id}`);
    }
}
async function deleteJobPriority(team_id, job_id) {
    try {
        const setKey = SET_KEY_PREFIX + team_id;
        // remove job_id from the set
        await redis_1.redisEvictConnection.srem(setKey, job_id);
    }
    catch (e) {
        logger_1.logger.error(`Delete job priority (srem) failed: ${team_id}, ${job_id}`);
    }
}
async function getJobPriority({ team_id, basePriority = 10, from_extract = false, }) {
    if (team_id === "d97c4ceb-290b-4957-8432-2b2a02727d95") {
        return 50;
    }
    try {
        const acuc = await (0, auth_1.getACUCTeam)(team_id, false, true, from_extract ? types_1.RateLimiterMode.Extract : types_1.RateLimiterMode.Crawl);
        const setKey = SET_KEY_PREFIX + team_id;
        // Get the length of the set
        const setLength = await redis_1.redisEvictConnection.scard(setKey);
        // Determine the priority based on the plan and set length
        let planModifier = acuc?.plan_priority.planModifier ?? 1;
        let bucketLimit = acuc?.plan_priority.bucketLimit ?? 25;
        // if length set is smaller than set, just return base priority
        if (setLength <= bucketLimit) {
            return basePriority;
        }
        else {
            // If not, we keep base priority + planModifier
            return Math.ceil(basePriority + Math.ceil((setLength - bucketLimit) * planModifier));
        }
    }
    catch (e) {
        logger_1.logger.error(`Get job priority failed: ${team_id}, ${basePriority}`);
        return basePriority;
    }
}
//# sourceMappingURL=job-priority.js.map