"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseGetJobByIdOnlyData = exports.supabaseGetJobsByCrawlId = exports.supabaseGetJobsById = exports.supabaseGetJobById = void 0;
const supabase_1 = require("../services/supabase");
const logger_1 = require("./logger");
const Sentry = __importStar(require("@sentry/node"));
/**
 * Get a single firecrawl_job by ID
 * @param jobId ID of Job
 * @returns {any | null} Job
 */
const supabaseGetJobById = async (jobId) => {
    const { data, error } = await supabase_1.supabase_rr_service
        .from("firecrawl_jobs")
        .select("*")
        .eq("job_id", jobId)
        .single();
    if (error) {
        return null;
    }
    if (!data) {
        return null;
    }
    return data;
};
exports.supabaseGetJobById = supabaseGetJobById;
/**
 * Get multiple firecrawl_jobs by ID. Use this if you're not requesting a lot (50+) of jobs at once.
 * @param jobIds IDs of Jobs
 * @returns {any[]} Jobs
 */
const supabaseGetJobsById = async (jobIds) => {
    const { data, error } = await supabase_1.supabase_rr_service
        .from("firecrawl_jobs")
        .select()
        .in("job_id", jobIds);
    if (error) {
        logger_1.logger.error(`Error in supabaseGetJobsById: ${error}`);
        Sentry.captureException(error);
        return [];
    }
    if (!data) {
        return [];
    }
    return data;
};
exports.supabaseGetJobsById = supabaseGetJobsById;
/**
 * Get multiple firecrawl_jobs by crawl ID. Use this if you need a lot of jobs at once.
 * @param crawlId ID of crawl
 * @returns {any[]} Jobs
 */
const supabaseGetJobsByCrawlId = async (crawlId) => {
    const { data, error } = await supabase_1.supabase_rr_service
        .from("firecrawl_jobs")
        .select()
        .eq("crawl_id", crawlId);
    if (error) {
        logger_1.logger.error(`Error in supabaseGetJobsByCrawlId: ${error}`);
        Sentry.captureException(error);
        return [];
    }
    if (!data) {
        return [];
    }
    return data;
};
exports.supabaseGetJobsByCrawlId = supabaseGetJobsByCrawlId;
const supabaseGetJobByIdOnlyData = async (jobId, logger) => {
    const { data, error } = await supabase_1.supabase_rr_service
        .from("firecrawl_jobs")
        .select("team_id")
        .eq("job_id", jobId)
        .single();
    if (error) {
        if (logger) {
            logger.error("Error in supabaseGetJobByIdOnlyData", { error });
        }
        return null;
    }
    if (!data) {
        return null;
    }
    return data;
};
exports.supabaseGetJobByIdOnlyData = supabaseGetJobByIdOnlyData;
//# sourceMappingURL=supabase-jobs.js.map