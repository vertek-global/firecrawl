"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCachedACUC = setCachedACUC;
exports.getACUC = getACUC;
exports.setCachedACUCTeam = setCachedACUCTeam;
exports.getACUCTeam = getACUCTeam;
exports.clearACUC = clearACUC;
exports.clearACUCTeam = clearACUCTeam;
exports.authenticateUser = authenticateUser;
exports.supaAuthenticateUser = supaAuthenticateUser;
const parseApi_1 = require("../lib/parseApi");
const rate_limiter_1 = require("../services/rate-limiter");
const types_1 = require("../types");
const supabase_1 = require("../services/supabase");
const withAuth_1 = require("../lib/withAuth");
const logger_1 = require("../lib/logger");
const redlock_1 = require("../services/redlock");
const redis_1 = require("../services/redis");
const redis_2 = require("../services/redis");
const uuid_1 = require("uuid");
// const { data, error } = await supabase_service
//     .from('api_keys')
//     .select(`
//       key,
//       team_id,
//       teams (
//         subscriptions (
//           price_id
//         )
//       )
//     `)
//     .eq('key', normalizedApi)
//     .limit(1)
//     .single();
function normalizedApiIsUuid(potentialUuid) {
    // Check if the string is a valid UUID
    return (0, uuid_1.validate)(potentialUuid);
}
async function setCachedACUC(api_key, is_extract, acuc) {
    const cacheKeyACUC = `acuc_${api_key}_${is_extract ? "extract" : "scrape"}`;
    const redLockKey = `lock_${cacheKeyACUC}`;
    try {
        await redlock_1.redlock.using([redLockKey], 10000, {}, async (signal) => {
            if (typeof acuc === "function") {
                acuc = acuc(JSON.parse((await (0, redis_1.getValue)(cacheKeyACUC)) ?? "null"));
                if (acuc === null) {
                    if (signal.aborted) {
                        throw signal.error;
                    }
                    return;
                }
            }
            if (signal.aborted) {
                throw signal.error;
            }
            // Cache for 10 minutes. - mogery
            await (0, redis_2.setValue)(cacheKeyACUC, JSON.stringify(acuc), 600, true);
        });
    }
    catch (error) {
        logger_1.logger.error(`Error updating cached ACUC ${cacheKeyACUC}: ${error}`);
    }
}
const mockPreviewACUC = (team_id, is_extract) => ({
    api_key: "preview",
    team_id,
    sub_id: null,
    sub_current_period_start: null,
    sub_current_period_end: null,
    sub_user_id: null,
    price_id: null,
    rate_limits: {
        crawl: 2,
        scrape: 10,
        extract: 10,
        search: 5,
        map: 5,
        preview: 5,
        crawlStatus: 500,
        extractStatus: 500,
        extractAgentPreview: 1,
        scrapeAgentPreview: 5,
    },
    price_credits: 99999999,
    credits_used: 0,
    coupon_credits: 99999999,
    adjusted_credits_used: 0,
    remaining_credits: 99999999,
    total_credits_sum: 99999999,
    plan_priority: {
        bucketLimit: 25,
        planModifier: 0.1,
    },
    concurrency: is_extract ? 200 : 2,
    flags: null,
    is_extract,
});
const mockACUC = () => ({
    api_key: "bypass",
    team_id: "bypass",
    sub_id: "bypass",
    sub_current_period_start: new Date().toISOString(),
    sub_current_period_end: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    sub_user_id: "bypass",
    price_id: "bypass",
    rate_limits: {
        crawl: 99999999,
        scrape: 99999999,
        extract: 99999999,
        search: 99999999,
        map: 99999999,
        preview: 99999999,
        crawlStatus: 99999999,
        extractStatus: 99999999,
        extractAgentPreview: 99999999,
        scrapeAgentPreview: 99999999,
    },
    price_credits: 99999999,
    credits_used: 0,
    coupon_credits: 99999999,
    adjusted_credits_used: 0,
    remaining_credits: 99999999,
    total_credits_sum: 99999999,
    plan_priority: {
        bucketLimit: 25,
        planModifier: 0.1,
    },
    concurrency: 99999999,
    flags: null,
    is_extract: false,
});
async function getACUC(api_key, cacheOnly = false, useCache = true, mode) {
    let isExtract = mode === types_1.RateLimiterMode.Extract ||
        mode === types_1.RateLimiterMode.ExtractStatus ||
        mode === types_1.RateLimiterMode.ExtractAgentPreview;
    if (api_key === process.env.PREVIEW_TOKEN) {
        const acuc = mockPreviewACUC(api_key, isExtract);
        acuc.is_extract = isExtract;
        return acuc;
    }
    if (process.env.USE_DB_AUTHENTICATION !== "true") {
        const acuc = mockACUC();
        acuc.is_extract = isExtract;
        return acuc;
    }
    const cacheKeyACUC = `acuc_${api_key}_${isExtract ? "extract" : "scrape"}`;
    if (useCache) {
        const cachedACUC = await (0, redis_1.getValue)(cacheKeyACUC);
        if (cachedACUC !== null) {
            return JSON.parse(cachedACUC);
        }
    }
    if (!cacheOnly) {
        let data;
        let error;
        let retries = 0;
        const maxRetries = 5;
        while (retries < maxRetries) {
            const client = Math.random() > (2 / 3) ? supabase_1.supabase_rr_service : supabase_1.supabase_service;
            ({ data, error } = await client.rpc("auth_credit_usage_chunk_32", { input_key: api_key, i_is_extract: isExtract, tally_untallied_credits: true }, { get: true }));
            if (!error) {
                break;
            }
            logger_1.logger.warn(`Failed to retrieve authentication and credit usage data after ${retries}, trying again...`, { error });
            retries++;
            if (retries === maxRetries) {
                throw new Error("Failed to retrieve authentication and credit usage data after 3 attempts: " +
                    JSON.stringify(error));
            }
            // Wait for a short time before retrying
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const chunk = data.length === 0 ? null : data[0].team_id === null ? null : data[0];
        if (chunk) {
            chunk.is_extract = isExtract;
        }
        // NOTE: Should we cache null chunks? - mogery
        if (chunk !== null && useCache) {
            setCachedACUC(api_key, isExtract, chunk);
        }
        return chunk;
    }
    else {
        return null;
    }
}
async function setCachedACUCTeam(team_id, is_extract, acuc) {
    const cacheKeyACUC = `acuc_team_${team_id}_${is_extract ? "extract" : "scrape"}`;
    const redLockKey = `lock_${cacheKeyACUC}`;
    try {
        await redlock_1.redlock.using([redLockKey], 10000, {}, async (signal) => {
            if (typeof acuc === "function") {
                acuc = acuc(JSON.parse((await (0, redis_1.getValue)(cacheKeyACUC)) ?? "null"));
                if (acuc === null) {
                    if (signal.aborted) {
                        throw signal.error;
                    }
                    return;
                }
            }
            if (signal.aborted) {
                throw signal.error;
            }
            // Cache for 10 minutes. - mogery
            await (0, redis_2.setValue)(cacheKeyACUC, JSON.stringify(acuc), 600, true);
        });
    }
    catch (error) {
        logger_1.logger.error(`Error updating cached ACUC ${cacheKeyACUC}: ${error}`);
    }
}
async function getACUCTeam(team_id, cacheOnly = false, useCache = true, mode) {
    let isExtract = mode === types_1.RateLimiterMode.Extract ||
        mode === types_1.RateLimiterMode.ExtractStatus ||
        mode === types_1.RateLimiterMode.ExtractAgentPreview;
    if (team_id.startsWith("preview")) {
        const acuc = mockPreviewACUC(team_id, isExtract);
        return acuc;
    }
    if (process.env.USE_DB_AUTHENTICATION !== "true") {
        const acuc = mockACUC();
        acuc.is_extract = isExtract;
        return acuc;
    }
    const cacheKeyACUC = `acuc_team_${team_id}_${isExtract ? "extract" : "scrape"}`;
    if (useCache) {
        const cachedACUC = await (0, redis_1.getValue)(cacheKeyACUC);
        if (cachedACUC !== null) {
            return JSON.parse(cachedACUC);
        }
    }
    if (!cacheOnly) {
        let data;
        let error;
        let retries = 0;
        const maxRetries = 5;
        while (retries < maxRetries) {
            const client = Math.random() > (2 / 3) ? supabase_1.supabase_rr_service : supabase_1.supabase_service;
            ({ data, error } = await client.rpc("auth_credit_usage_chunk_32_from_team", { input_team: team_id, i_is_extract: isExtract, tally_untallied_credits: true }, { get: true }));
            if (!error) {
                break;
            }
            logger_1.logger.warn(`Failed to retrieve authentication and credit usage data after ${retries}, trying again...`, { error });
            retries++;
            if (retries === maxRetries) {
                throw new Error("Failed to retrieve authentication and credit usage data after 3 attempts: " +
                    JSON.stringify(error));
            }
            // Wait for a short time before retrying
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        const chunk = data.length === 0 ? null : data[0].team_id === null ? null : data[0];
        // NOTE: Should we cache null chunks? - mogery
        if (chunk !== null && useCache) {
            setCachedACUCTeam(team_id, isExtract, chunk);
        }
        return chunk ? { ...chunk, is_extract: isExtract } : null;
    }
    else {
        return null;
    }
}
async function clearACUC(api_key) {
    // Delete cache for all rate limiter modes
    const modes = [true, false];
    await Promise.all(modes.map(async (mode) => {
        const cacheKey = `acuc_${api_key}_${mode ? "extract" : "scrape"}`;
        await (0, redis_1.deleteKey)(cacheKey);
    }));
    // Also clear the base cache key
    await (0, redis_1.deleteKey)(`acuc_${api_key}`);
}
async function clearACUCTeam(team_id) {
    // Delete cache for all rate limiter modes
    const modes = [true, false];
    await Promise.all(modes.map(async (mode) => {
        const cacheKey = `acuc_team_${team_id}_${mode ? "extract" : "scrape"}`;
        await (0, redis_1.deleteKey)(cacheKey);
    }));
    // Also clear the base cache key
    await (0, redis_1.deleteKey)(`acuc_team_${team_id}`);
}
async function authenticateUser(req, res, mode) {
    return (0, withAuth_1.withAuth)(supaAuthenticateUser, {
        success: true,
        chunk: null,
        team_id: "bypass",
    })(req, res, mode);
}
async function supaAuthenticateUser(req, res, mode) {
    const authHeader = req.headers.authorization ??
        (req.headers["sec-websocket-protocol"]
            ? `Bearer ${req.headers["sec-websocket-protocol"]}`
            : null);
    if (!authHeader) {
        return { success: false, error: "Unauthorized", status: 401 };
    }
    const token = authHeader.split(" ")[1]; // Extract the token from "Bearer <token>"
    if (!token) {
        return {
            success: false,
            error: "Unauthorized: Token missing",
            status: 401,
        };
    }
    const incomingIP = (req.headers["x-preview-ip"] || req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress);
    const iptoken = incomingIP + token;
    let rateLimiter;
    let subscriptionData = null;
    let normalizedApi;
    let teamId = null;
    let priceId = null;
    let chunk = null;
    if (token == "this_is_just_a_preview_token") {
        throw new Error("Unauthenticated Playground calls are temporarily disabled due to abuse. Please sign up.");
    }
    if (token == process.env.PREVIEW_TOKEN) {
        if (mode == types_1.RateLimiterMode.CrawlStatus) {
            rateLimiter = (0, rate_limiter_1.getRateLimiter)(types_1.RateLimiterMode.CrawlStatus, token);
        }
        else if (mode == types_1.RateLimiterMode.ExtractStatus) {
            rateLimiter = (0, rate_limiter_1.getRateLimiter)(types_1.RateLimiterMode.ExtractStatus, token);
        }
        else {
            rateLimiter = (0, rate_limiter_1.getRateLimiter)(types_1.RateLimiterMode.Preview, token);
        }
        teamId = `preview_${iptoken}`;
    }
    else {
        normalizedApi = (0, parseApi_1.parseApi)(token);
        if (!normalizedApiIsUuid(normalizedApi)) {
            return {
                success: false,
                error: "Unauthorized: Invalid token",
                status: 401,
            };
        }
        chunk = await getACUC(normalizedApi, false, true, mode);
        if (chunk === null) {
            return {
                success: false,
                error: "Unauthorized: Invalid token",
                status: 401,
            };
        }
        teamId = chunk.team_id;
        priceId = chunk.price_id;
        subscriptionData = {
            team_id: teamId,
        };
        rateLimiter = (0, rate_limiter_1.getRateLimiter)(mode ?? types_1.RateLimiterMode.Crawl, chunk.rate_limits);
    }
    const team_endpoint_token = token === process.env.PREVIEW_TOKEN ? iptoken : teamId;
    try {
        await rateLimiter.consume(team_endpoint_token);
    }
    catch (rateLimiterRes) {
        logger_1.logger.error(`Rate limit exceeded: ${rateLimiterRes}`, {
            teamId,
            priceId,
            mode,
            rateLimits: chunk?.rate_limits,
            rateLimiterRes,
        });
        const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;
        const retryDate = new Date(Date.now() + rateLimiterRes.msBeforeNext);
        // We can only send a rate limit email every 7 days, send notification already has the date in between checking
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        // await sendNotification(team_id, NotificationType.RATE_LIMIT_REACHED, startDate.toISOString(), endDate.toISOString());
        return {
            success: false,
            error: `Rate limit exceeded. Consumed (req/min): ${rateLimiterRes.consumedPoints}, Remaining (req/min): ${rateLimiterRes.remainingPoints}. Upgrade your plan at https://firecrawl.dev/pricing for increased rate limits or please retry after ${secs}s, resets at ${retryDate}`,
            status: 429,
        };
    }
    if (token === process.env.PREVIEW_TOKEN &&
        (mode === types_1.RateLimiterMode.Scrape ||
            mode === types_1.RateLimiterMode.Preview ||
            mode === types_1.RateLimiterMode.Map ||
            mode === types_1.RateLimiterMode.Crawl ||
            mode === types_1.RateLimiterMode.CrawlStatus ||
            mode === types_1.RateLimiterMode.Extract ||
            mode === types_1.RateLimiterMode.Search)) {
        return {
            success: true,
            team_id: `preview_${iptoken}`,
            chunk: null,
        };
        // check the origin of the request and make sure its from firecrawl.dev
        // const origin = req.headers.origin;
        // if (origin && origin.includes("firecrawl.dev")){
        //   return { success: true, team_id: "preview" };
        // }
        // if(process.env.ENV !== "production") {
        //   return { success: true, team_id: "preview" };
        // }
        // return { success: false, error: "Unauthorized: Invalid token", status: 401 };
    }
    return {
        success: true,
        team_id: teamId ?? undefined,
        chunk,
    };
}
//# sourceMappingURL=auth.js.map