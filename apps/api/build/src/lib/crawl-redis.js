"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCrawl = saveCrawl;
exports.getCrawlsByTeamId = getCrawlsByTeamId;
exports.getCrawl = getCrawl;
exports.getCrawlExpiry = getCrawlExpiry;
exports.addCrawlJob = addCrawlJob;
exports.addCrawlJobs = addCrawlJobs;
exports.addCrawlJobDone = addCrawlJobDone;
exports.getDoneJobsOrderedLength = getDoneJobsOrderedLength;
exports.getDoneJobsOrdered = getDoneJobsOrdered;
exports.isCrawlFinished = isCrawlFinished;
exports.isCrawlKickoffFinished = isCrawlKickoffFinished;
exports.isCrawlFinishedLocked = isCrawlFinishedLocked;
exports.finishCrawlKickoff = finishCrawlKickoff;
exports.finishCrawlPre = finishCrawlPre;
exports.unPreFinishCrawl = unPreFinishCrawl;
exports.finishCrawl = finishCrawl;
exports.getCrawlJobs = getCrawlJobs;
exports.getCrawlJobCount = getCrawlJobCount;
exports.normalizeURL = normalizeURL;
exports.generateURLPermutations = generateURLPermutations;
exports.lockURL = lockURL;
exports.lockURLs = lockURLs;
exports.lockURLsIndividually = lockURLsIndividually;
exports.crawlToCrawler = crawlToCrawler;
const crawler_1 = require("../scraper/WebScraper/crawler");
const redis_1 = require("../services/redis");
const logger_1 = require("./logger");
const maxDepthUtils_1 = require("../scraper/WebScraper/utils/maxDepthUtils");
async function saveCrawl(id, crawl) {
    logger_1.logger.debug("Saving crawl " + id + " to Redis...", {
        crawl,
        module: "crawl-redis",
        method: "saveCrawl",
        crawlId: id,
        teamId: crawl.team_id,
        zeroDataRetention: crawl.zeroDataRetention,
    });
    await redis_1.redisEvictConnection.set("crawl:" + id, JSON.stringify(crawl));
    await redis_1.redisEvictConnection.expire("crawl:" + id, 24 * 60 * 60);
    await redis_1.redisEvictConnection.sadd("crawls_by_team_id:" + crawl.team_id, id);
    await redis_1.redisEvictConnection.expire("crawls_by_team_id:" + crawl.team_id, 24 * 60 * 60);
}
async function getCrawlsByTeamId(team_id) {
    return await redis_1.redisEvictConnection.smembers("crawls_by_team_id:" + team_id);
}
async function getCrawl(id) {
    const x = await redis_1.redisEvictConnection.get("crawl:" + id);
    if (x === null) {
        return null;
    }
    await redis_1.redisEvictConnection.expire("crawl:" + id, 24 * 60 * 60);
    return JSON.parse(x);
}
async function getCrawlExpiry(id) {
    const d = new Date();
    const ttl = await redis_1.redisEvictConnection.pttl("crawl:" + id);
    d.setMilliseconds(d.getMilliseconds() + ttl);
    d.setMilliseconds(0);
    return d;
}
async function addCrawlJob(id, job_id, __logger = logger_1.logger) {
    __logger.debug("Adding crawl job " + job_id + " to Redis...", {
        jobId: job_id,
        module: "crawl-redis",
        method: "addCrawlJob",
        crawlId: id,
    });
    await redis_1.redisEvictConnection.sadd("crawl:" + id + ":jobs", job_id);
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":jobs", 24 * 60 * 60);
}
async function addCrawlJobs(id, job_ids, __logger = logger_1.logger) {
    if (job_ids.length === 0)
        return true;
    __logger.debug("Adding crawl jobs to Redis...", {
        jobIds: job_ids,
        module: "crawl-redis",
        method: "addCrawlJobs",
        crawlId: id,
    });
    await redis_1.redisEvictConnection.sadd("crawl:" + id + ":jobs", ...job_ids);
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":jobs", 24 * 60 * 60);
}
async function addCrawlJobDone(id, job_id, success, __logger = logger_1.logger) {
    __logger.debug("Adding done crawl job to Redis...", {
        jobId: job_id,
        module: "crawl-redis",
        method: "addCrawlJobDone",
        crawlId: id,
    });
    await redis_1.redisEvictConnection.sadd("crawl:" + id + ":jobs_done", job_id);
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":jobs_done", 24 * 60 * 60);
    if (success) {
        await redis_1.redisEvictConnection.rpush("crawl:" + id + ":jobs_done_ordered", job_id);
    }
    else {
        // in case it's already been pushed, make sure it's removed
        await redis_1.redisEvictConnection.lrem("crawl:" + id + ":jobs_done_ordered", -1, job_id);
    }
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":jobs_done_ordered", 24 * 60 * 60);
}
async function getDoneJobsOrderedLength(id) {
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":jobs_done_ordered", 24 * 60 * 60);
    return await redis_1.redisEvictConnection.llen("crawl:" + id + ":jobs_done_ordered");
}
async function getDoneJobsOrdered(id, start = 0, end = -1) {
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":jobs_done_ordered", 24 * 60 * 60);
    return await redis_1.redisEvictConnection.lrange("crawl:" + id + ":jobs_done_ordered", start, end);
}
async function isCrawlFinished(id) {
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":kickoff:finish", 24 * 60 * 60);
    return ((await redis_1.redisEvictConnection.scard("crawl:" + id + ":jobs_done")) ===
        (await redis_1.redisEvictConnection.scard("crawl:" + id + ":jobs")) &&
        (await redis_1.redisEvictConnection.get("crawl:" + id + ":kickoff:finish")) !== null);
}
async function isCrawlKickoffFinished(id) {
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":kickoff:finish", 24 * 60 * 60);
    return ((await redis_1.redisEvictConnection.get("crawl:" + id + ":kickoff:finish")) !== null);
}
async function isCrawlFinishedLocked(id) {
    return await redis_1.redisEvictConnection.exists("crawl:" + id + ":finish");
}
async function finishCrawlKickoff(id) {
    await redis_1.redisEvictConnection.set("crawl:" + id + ":kickoff:finish", "yes", "EX", 24 * 60 * 60);
}
async function finishCrawlPre(id, __logger = logger_1.logger) {
    if (await isCrawlFinished(id)) {
        __logger.debug("Marking crawl as pre-finished.", {
            module: "crawl-redis",
            method: "finishCrawlPre",
            crawlId: id,
        });
        const set = await redis_1.redisEvictConnection.setnx("crawl:" + id + ":finished_pre", "yes");
        await redis_1.redisEvictConnection.expire("crawl:" + id + ":finished_pre", 24 * 60 * 60);
        return set === 1;
    }
}
async function unPreFinishCrawl(id) {
    logger_1.logger.debug("Un-pre-finishing crawl.", {
        module: "crawl-redis",
        method: "unPreFinishCrawl",
        crawlId: id,
    });
    await redis_1.redisEvictConnection.del("crawl:" + id + ":finished_pre");
}
async function finishCrawl(id, __logger = logger_1.logger) {
    __logger.debug("Marking crawl as finished.", {
        module: "crawl-redis",
        method: "finishCrawl",
        crawlId: id,
    });
    await redis_1.redisEvictConnection.set("crawl:" + id + ":finish", "yes");
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":finish", 24 * 60 * 60);
    const crawl = await getCrawl(id);
    if (crawl && crawl.team_id) {
        await redis_1.redisEvictConnection.srem("crawls_by_team_id:" + crawl.team_id, id);
        await redis_1.redisEvictConnection.expire("crawls_by_team_id:" + crawl.team_id, 24 * 60 * 60);
    }
}
async function getCrawlJobs(id) {
    return await redis_1.redisEvictConnection.smembers("crawl:" + id + ":jobs");
}
async function getCrawlJobCount(id) {
    return await redis_1.redisEvictConnection.scard("crawl:" + id + ":jobs");
}
function normalizeURL(url, sc) {
    const urlO = new URL(url);
    if (!sc.crawlerOptions || sc.crawlerOptions.ignoreQueryParameters) {
        urlO.search = "";
    }
    urlO.hash = "";
    return urlO.href;
}
function generateURLPermutations(url) {
    const urlO = new URL(url);
    // Construct two versions, one with www., one without
    const urlWithWWW = new URL(urlO);
    const urlWithoutWWW = new URL(urlO);
    if (urlO.hostname.startsWith("www.")) {
        urlWithoutWWW.hostname = urlWithWWW.hostname.slice(4);
    }
    else {
        urlWithWWW.hostname = "www." + urlWithoutWWW.hostname;
    }
    let permutations = [urlWithWWW, urlWithoutWWW];
    // Construct more versions for http/https
    permutations = permutations.flatMap((urlO) => {
        if (!["http:", "https:"].includes(urlO.protocol)) {
            return [urlO];
        }
        const urlWithHTTP = new URL(urlO);
        const urlWithHTTPS = new URL(urlO);
        urlWithHTTP.protocol = "http:";
        urlWithHTTPS.protocol = "https:";
        return [urlWithHTTP, urlWithHTTPS];
    });
    // Construct more versions for index.html/index.php
    permutations = permutations.flatMap((urlO) => {
        const urlWithHTML = new URL(urlO);
        const urlWithPHP = new URL(urlO);
        const urlWithBare = new URL(urlO);
        const urlWithSlash = new URL(urlO);
        if (urlO.pathname.endsWith("/")) {
            urlWithBare.pathname = urlWithBare.pathname.length === 1 ? urlWithBare.pathname : urlWithBare.pathname.slice(0, -1);
            urlWithHTML.pathname += "index.html";
            urlWithPHP.pathname += "index.php";
        }
        else if (urlO.pathname.endsWith("/index.html")) {
            urlWithPHP.pathname = urlWithPHP.pathname.slice(0, -"index.html".length) + "index.php";
            urlWithSlash.pathname = urlWithSlash.pathname.slice(0, -"index.html".length);
            urlWithBare.pathname = urlWithBare.pathname.slice(0, -"/index.html".length);
        }
        else if (urlO.pathname.endsWith("/index.php")) {
            urlWithHTML.pathname = urlWithHTML.pathname.slice(0, -"index.php".length) + "index.html";
            urlWithSlash.pathname = urlWithSlash.pathname.slice(0, -"index.php".length);
            urlWithBare.pathname = urlWithBare.pathname.slice(0, -"/index.php".length);
        }
        else {
            urlWithSlash.pathname += "/";
            urlWithHTML.pathname += "/index.html";
            urlWithPHP.pathname += "/index.php";
        }
        return [urlWithHTML, urlWithPHP, urlWithSlash, urlWithBare];
    });
    return [...new Set(permutations.map(x => x.href))].map(x => new URL(x));
}
async function lockURL(id, sc, url) {
    if (typeof sc.crawlerOptions?.limit === "number") {
        if ((await redis_1.redisEvictConnection.scard("crawl:" + id + ":visited_unique")) >=
            sc.crawlerOptions.limit) {
            return false;
        }
    }
    let res;
    if (!sc.crawlerOptions?.deduplicateSimilarURLs) {
        res = (await redis_1.redisEvictConnection.sadd("crawl:" + id + ":visited", url)) !== 0;
    }
    else {
        const permutations = generateURLPermutations(url).map((x) => x.href);
        const x = await redis_1.redisEvictConnection.sadd("crawl:" + id + ":visited", ...permutations);
        res = x === permutations.length;
    }
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":visited", 24 * 60 * 60);
    if (res) {
        await redis_1.redisEvictConnection.sadd("crawl:" + id + ":visited_unique", url);
        await redis_1.redisEvictConnection.expire("crawl:" + id + ":visited_unique", 24 * 60 * 60);
    }
    return res;
}
/// NOTE: does not check limit. only use if limit is checked beforehand e.g. with sitemap
async function lockURLs(id, sc, urls, __logger = logger_1.logger) {
    if (urls.length === 0)
        return true;
    urls = urls.map((url) => normalizeURL(url, sc));
    const logger = __logger.child({
        crawlId: id,
        module: "crawl-redis",
        method: "lockURL",
        teamId: sc.team_id,
    });
    // Add to visited_unique set
    logger.debug("Locking " + urls.length + " URLs...");
    await redis_1.redisEvictConnection.sadd("crawl:" + id + ":visited_unique", ...urls);
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":visited_unique", 24 * 60 * 60);
    let res;
    if (!sc.crawlerOptions?.deduplicateSimilarURLs) {
        const x = await redis_1.redisEvictConnection.sadd("crawl:" + id + ":visited", ...urls);
        res = x === urls.length;
    }
    else {
        const allPermutations = urls.flatMap((url) => generateURLPermutations(url).map((x) => x.href));
        logger.debug("Adding " + allPermutations.length + " URL permutations...");
        const x = await redis_1.redisEvictConnection.sadd("crawl:" + id + ":visited", ...allPermutations);
        res = x === allPermutations.length;
    }
    await redis_1.redisEvictConnection.expire("crawl:" + id + ":visited", 24 * 60 * 60);
    logger.debug("lockURLs final result: " + res, { res });
    return res;
}
async function lockURLsIndividually(id, sc, jobs) {
    const out = [];
    for (const job of jobs) {
        if (await lockURL(id, sc, job.url)) {
            out.push(job);
        }
    }
    return out;
}
function crawlToCrawler(id, sc, teamFlags, newBase, crawlerOptions) {
    const crawler = new crawler_1.WebCrawler({
        jobId: id,
        initialUrl: sc.originUrl,
        baseUrl: newBase ? new URL(newBase).origin : undefined,
        includes: (sc.crawlerOptions?.includes ?? []).filter(x => x.trim().length > 0),
        excludes: (sc.crawlerOptions?.excludes ?? []).filter(x => x.trim().length > 0),
        maxCrawledLinks: sc.crawlerOptions?.maxCrawledLinks ?? 1000,
        maxCrawledDepth: (0, maxDepthUtils_1.getAdjustedMaxDepth)(sc.originUrl, sc.crawlerOptions?.maxDepth ?? 10),
        limit: sc.crawlerOptions?.limit ?? 10000,
        generateImgAltText: sc.crawlerOptions?.generateImgAltText ?? false,
        allowBackwardCrawling: sc.crawlerOptions?.allowBackwardCrawling ?? false,
        allowExternalContentLinks: sc.crawlerOptions?.allowExternalContentLinks ?? false,
        allowSubdomains: sc.crawlerOptions?.allowSubdomains ?? false,
        ignoreRobotsTxt: teamFlags?.ignoreRobots ?? sc.crawlerOptions?.ignoreRobotsTxt ?? false,
        regexOnFullURL: sc.crawlerOptions?.regexOnFullURL ?? false,
        maxDiscoveryDepth: sc.crawlerOptions?.maxDiscoveryDepth,
        currentDiscoveryDepth: crawlerOptions?.currentDiscoveryDepth ?? 0,
        zeroDataRetention: (teamFlags?.forceZDR || sc.zeroDataRetention) ?? false,
    });
    if (sc.robots !== undefined) {
        try {
            crawler.importRobotsTxt(sc.robots);
        }
        catch (_) { }
    }
    return crawler;
}
//# sourceMappingURL=crawl-redis.js.map