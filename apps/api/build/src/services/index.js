"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIndex = exports.index_supabase_service = void 0;
exports.getIndexFromGCS = getIndexFromGCS;
exports.saveIndexToGCS = saveIndexToGCS;
exports.normalizeURLForIndex = normalizeURLForIndex;
exports.hashURL = hashURL;
exports.generateURLSplits = generateURLSplits;
exports.generateDomainSplits = generateDomainSplits;
exports.addIndexInsertJob = addIndexInsertJob;
exports.getIndexInsertJobs = getIndexInsertJobs;
exports.processIndexInsertJobs = processIndexInsertJobs;
exports.getIndexInsertQueueLength = getIndexInsertQueueLength;
exports.queryIndexAtSplitLevel = queryIndexAtSplitLevel;
exports.queryIndexAtDomainSplitLevel = queryIndexAtDomainSplitLevel;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../lib/logger");
const dotenv_1 = require("dotenv");
const storage_1 = require("@google-cloud/storage");
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("./redis");
const psl_1 = __importDefault(require("psl"));
(0, dotenv_1.configDotenv)();
// SupabaseService class initializes the Supabase client conditionally based on environment variables.
class IndexSupabaseService {
    client = null;
    constructor() {
        const supabaseUrl = process.env.INDEX_SUPABASE_URL;
        const supabaseServiceToken = process.env.INDEX_SUPABASE_SERVICE_TOKEN;
        // Only initialize the Supabase client if both URL and Service Token are provided.
        if (!supabaseUrl || !supabaseServiceToken) {
            // Warn the user that Authentication is disabled by setting the client to null
            logger_1.logger.warn("Index supabase client will not be initialized.");
            this.client = null;
        }
        else {
            this.client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceToken);
        }
    }
    // Provides access to the initialized Supabase client, if available.
    getClient() {
        return this.client;
    }
}
const serv = new IndexSupabaseService();
// Using a Proxy to handle dynamic access to the Supabase client or service methods.
// This approach ensures that if Supabase is not configured, any attempt to use it will result in a clear error.
exports.index_supabase_service = new Proxy(serv, {
    get: function (target, prop, receiver) {
        const client = target.getClient();
        // If the Supabase client is not initialized, intercept property access to provide meaningful error feedback.
        if (client === null) {
            return () => {
                throw new Error("Index supabase client is not configured.");
            };
        }
        // Direct access to SupabaseService properties takes precedence.
        if (prop in target) {
            return Reflect.get(target, prop, receiver);
        }
        // Otherwise, delegate access to the Supabase client.
        return Reflect.get(client, prop, receiver);
    },
});
const credentials = process.env.GCS_CREDENTIALS ? JSON.parse(atob(process.env.GCS_CREDENTIALS)) : undefined;
async function getIndexFromGCS(url, logger) {
    //   logger.info(`Getting f-engine document from GCS`, {
    //     url,
    //   });
    try {
        if (!process.env.GCS_INDEX_BUCKET_NAME) {
            return null;
        }
        const storage = new storage_1.Storage({ credentials });
        const bucket = storage.bucket(process.env.GCS_INDEX_BUCKET_NAME);
        const blob = bucket.file(`${url}`);
        const [blobContent] = await blob.download();
        const parsed = JSON.parse(blobContent.toString());
        return parsed;
    }
    catch (error) {
        if (error instanceof storage_1.ApiError && error.code === 404 && error.message.includes("No such object:")) {
            // Object does not exist
            return null;
        }
        (logger ?? logger_1.logger).error(`Error getting Index document from GCS`, {
            error,
            url,
        });
        return null;
    }
}
async function saveIndexToGCS(id, doc) {
    try {
        if (!process.env.GCS_INDEX_BUCKET_NAME) {
            return;
        }
        const storage = new storage_1.Storage({ credentials });
        const bucket = storage.bucket(process.env.GCS_INDEX_BUCKET_NAME);
        const blob = bucket.file(`${id}.json`);
        for (let i = 0; i < 3; i++) {
            try {
                await blob.save(JSON.stringify(doc), {
                    contentType: "application/json",
                });
                break;
            }
            catch (error) {
                if (i === 2) {
                    throw error;
                }
                else {
                    logger_1.logger.error(`Error saving index document to GCS, retrying`, {
                        error,
                        indexId: id,
                        i,
                    });
                }
            }
        }
    }
    catch (error) {
        throw new Error("Error saving index document to GCS", {
            cause: error,
        });
    }
}
exports.useIndex = process.env.INDEX_SUPABASE_URL !== "" &&
    process.env.INDEX_SUPABASE_URL !== undefined;
function normalizeURLForIndex(url) {
    const urlObj = new URL(url);
    urlObj.hash = "";
    urlObj.protocol = "https";
    if (urlObj.port === "80" || urlObj.port === "443") {
        urlObj.port = "";
    }
    if (urlObj.hostname.startsWith("www.")) {
        urlObj.hostname = urlObj.hostname.slice(4);
    }
    if (urlObj.pathname.endsWith("/index.html")) {
        urlObj.pathname = urlObj.pathname.slice(0, -10);
    }
    else if (urlObj.pathname.endsWith("/index.php")) {
        urlObj.pathname = urlObj.pathname.slice(0, -9);
    }
    else if (urlObj.pathname.endsWith("/index.htm")) {
        urlObj.pathname = urlObj.pathname.slice(0, -9);
    }
    else if (urlObj.pathname.endsWith("/index.shtml")) {
        urlObj.pathname = urlObj.pathname.slice(0, -11);
    }
    else if (urlObj.pathname.endsWith("/index.xml")) {
        urlObj.pathname = urlObj.pathname.slice(0, -9);
    }
    if (urlObj.pathname.endsWith("/")) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    return urlObj.toString();
}
function hashURL(url) {
    return "\\x" + crypto_1.default.createHash("sha256").update(url).digest("hex");
}
function generateURLSplits(url) {
    const urls = [];
    const urlObj = new URL(url);
    urlObj.hash = "";
    urlObj.search = "";
    const pathnameParts = urlObj.pathname.split("/");
    for (let i = 0; i <= pathnameParts.length; i++) {
        urlObj.pathname = pathnameParts.slice(0, i).join("/");
        urls.push(urlObj.href);
    }
    urls.push(url);
    return [...new Set(urls.map(x => normalizeURLForIndex(x)))];
}
function generateDomainSplits(hostname) {
    const parsed = psl_1.default.parse(hostname);
    if (parsed === null) {
        return [];
    }
    const subdomains = (parsed.subdomain ?? "").split(".").filter(x => x !== "");
    if (subdomains.length === 1 && subdomains[0] === "www") {
        return [parsed.domain];
    }
    const domains = [];
    for (let i = subdomains.length; i >= 0; i--) {
        domains.push(subdomains.slice(i).concat([parsed.domain]).join("."));
    }
    return domains;
}
const INDEX_INSERT_QUEUE_KEY = "index-insert-queue";
const INDEX_INSERT_BATCH_SIZE = 1000;
async function addIndexInsertJob(data) {
    await redis_1.redisEvictConnection.rpush(INDEX_INSERT_QUEUE_KEY, JSON.stringify(data));
}
async function getIndexInsertJobs() {
    const jobs = (await redis_1.redisEvictConnection.lpop(INDEX_INSERT_QUEUE_KEY, INDEX_INSERT_BATCH_SIZE)) ?? [];
    return jobs.map(x => JSON.parse(x));
}
async function processIndexInsertJobs() {
    const jobs = await getIndexInsertJobs();
    if (jobs.length === 0) {
        return;
    }
    logger_1.logger.info(`Index inserter found jobs to insert`, { jobCount: jobs.length });
    try {
        await exports.index_supabase_service.from("index").insert(jobs);
        logger_1.logger.info(`Index inserter inserted jobs`, { jobCount: jobs.length });
    }
    catch (error) {
        logger_1.logger.error(`Index inserter failed to insert jobs`, { error, jobCount: jobs.length });
    }
}
async function getIndexInsertQueueLength() {
    return await redis_1.redisEvictConnection.llen(INDEX_INSERT_QUEUE_KEY) ?? 0;
}
async function queryIndexAtSplitLevel(url, limit, maxAge = 2 * 24 * 60 * 60 * 1000) {
    if (!exports.useIndex || process.env.FIRECRAWL_INDEX_WRITE_ONLY === "true") {
        return [];
    }
    const urlObj = new URL(url);
    urlObj.search = "";
    const urlSplitsHash = generateURLSplits(urlObj.href).map(x => hashURL(x));
    const level = urlSplitsHash.length - 1;
    let links = new Set();
    let iteration = 0;
    while (true) {
        // Query the index for the next set of links
        const { data: _data, error } = await exports.index_supabase_service
            .rpc("query_index_at_split_level", {
            i_level: level,
            i_url_hash: urlSplitsHash[level],
            i_newer_than: new Date(Date.now() - maxAge).toISOString(),
        })
            .range(iteration * 1000, (iteration + 1) * 1000);
        // If there's an error, return the links we have
        if (error) {
            logger_1.logger.warn("Error querying index", { error, url, limit });
            return [...links].slice(0, limit);
        }
        // Add the links to the set
        const data = _data ?? [];
        data.forEach((x) => links.add(x.resolved_url));
        // If we have enough links, return them
        if (links.size >= limit) {
            return [...links].slice(0, limit);
        }
        // If we get less than 1000 links from the query, we're done
        if (data.length < 1000) {
            return [...links].slice(0, limit);
        }
        iteration++;
    }
}
async function queryIndexAtDomainSplitLevel(hostname, limit, maxAge = 2 * 24 * 60 * 60 * 1000) {
    if (!exports.useIndex || process.env.FIRECRAWL_INDEX_WRITE_ONLY === "true") {
        return [];
    }
    const domainSplitsHash = generateDomainSplits(hostname).map(x => hashURL(x));
    const level = domainSplitsHash.length - 1;
    if (domainSplitsHash.length === 0) {
        return [];
    }
    let links = new Set();
    let iteration = 0;
    while (true) {
        // Query the index for the next set of links
        const { data: _data, error } = await exports.index_supabase_service
            .rpc("query_index_at_domain_split_level", {
            i_level: level,
            i_domain_hash: domainSplitsHash[level],
            i_newer_than: new Date(Date.now() - maxAge).toISOString(),
        })
            .range(iteration * 1000, (iteration + 1) * 1000);
        // If there's an error, return the links we have
        if (error) {
            logger_1.logger.warn("Error querying index", { error, hostname, limit });
            return [...links].slice(0, limit);
        }
        // Add the links to the set
        const data = _data ?? [];
        data.forEach((x) => links.add(x.resolved_url));
        // If we have enough links, return them
        if (links.size >= limit) {
            return [...links].slice(0, limit);
        }
        // If we get less than 1000 links from the query, we're done
        if (data.length < 1000) {
            return [...links].slice(0, limit);
        }
        iteration++;
    }
}
//# sourceMappingURL=index.js.map