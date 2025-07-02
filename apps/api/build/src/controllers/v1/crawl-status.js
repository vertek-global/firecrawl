"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJob = getJob;
exports.getJobs = getJobs;
exports.crawlStatusController = crawlStatusController;
const crawl_redis_1 = require("../../lib/crawl-redis");
const queue_service_1 = require("../../services/queue-service");
const supabase_jobs_1 = require("../../lib/supabase-jobs");
const dotenv_1 = require("dotenv");
const logger_1 = require("../../lib/logger");
const supabase_1 = require("../../services/supabase");
const concurrency_limit_1 = require("../../lib/concurrency-limit");
const gcs_jobs_1 = require("../../lib/gcs-jobs");
(0, dotenv_1.configDotenv)();
async function getJob(id) {
    const [bullJob, dbJob, gcsJob] = await Promise.all([
        (0, queue_service_1.getScrapeQueue)().getJob(id),
        (process.env.USE_DB_AUTHENTICATION === "true" ? (0, supabase_jobs_1.supabaseGetJobById)(id) : null),
        (process.env.GCS_BUCKET_NAME ? (0, gcs_jobs_1.getJobFromGCS)(id) : null),
    ]);
    if (!bullJob && !dbJob)
        return null;
    const data = gcsJob ?? dbJob?.docs ?? bullJob?.returnvalue;
    if (gcsJob === null && data) {
        logger_1.logger.warn("GCS Job not found", {
            jobId: id,
        });
    }
    const job = {
        id,
        getState: bullJob ? bullJob.getState : (() => dbJob.success ? "completed" : "failed"),
        returnvalue: Array.isArray(data)
            ? data[0]
            : data,
        data: {
            scrapeOptions: bullJob ? bullJob.data.scrapeOptions : dbJob.page_options,
        },
        timestamp: bullJob ? bullJob.timestamp : new Date(dbJob.date_added).valueOf(),
        failedReason: (bullJob ? bullJob.failedReason : dbJob.message) || undefined,
    };
    return job;
}
async function getJobs(ids) {
    const [bullJobs, dbJobs, gcsJobs] = await Promise.all([
        Promise.all(ids.map((x) => (0, queue_service_1.getScrapeQueue)().getJob(x))).then(x => x.filter(x => x)),
        process.env.USE_DB_AUTHENTICATION === "true" ? (0, supabase_jobs_1.supabaseGetJobsById)(ids) : [],
        process.env.GCS_BUCKET_NAME ? Promise.all(ids.map(async (x) => ({ id: x, job: await (0, gcs_jobs_1.getJobFromGCS)(x) }))).then(x => x.filter(x => x.job)) : [],
    ]);
    const bullJobMap = new Map();
    const dbJobMap = new Map();
    const gcsJobMap = new Map();
    for (const job of bullJobs) {
        bullJobMap.set(job.id, job);
    }
    for (const job of dbJobs) {
        dbJobMap.set(job.job_id, job);
    }
    for (const job of gcsJobs) {
        gcsJobMap.set(job.id, job.job);
    }
    const jobs = [];
    for (const id of ids) {
        const bullJob = bullJobMap.get(id);
        const dbJob = dbJobMap.get(id);
        const gcsJob = gcsJobMap.get(id);
        if (!bullJob && !dbJob)
            continue;
        const data = gcsJob ?? dbJob?.docs ?? bullJob?.returnvalue;
        if (gcsJob === null && data) {
            logger_1.logger.warn("GCS Job not found", {
                jobId: id,
            });
        }
        const job = {
            id,
            getState: bullJob ? (() => bullJob.getState()) : (() => dbJob.success ? "completed" : "failed"),
            returnvalue: Array.isArray(data)
                ? data[0]
                : data,
            data: {
                scrapeOptions: bullJob ? bullJob.data.scrapeOptions : dbJob.page_options,
            },
            timestamp: bullJob ? bullJob.timestamp : new Date(dbJob.date_added).valueOf(),
            failedReason: (bullJob ? bullJob.failedReason : dbJob.message) || undefined,
        };
        jobs.push(job);
    }
    return jobs;
}
async function crawlStatusController(req, res, isBatch = false) {
    const start = typeof req.query.skip === "string" ? parseInt(req.query.skip, 10) : 0;
    const end = typeof req.query.limit === "string"
        ? start + parseInt(req.query.limit, 10) - 1
        : undefined;
    const sc = await (0, crawl_redis_1.getCrawl)(req.params.jobId);
    let status;
    let doneJobsLength;
    let doneJobsOrder;
    let totalCount;
    let creditsUsed;
    if (sc) {
        if (sc.team_id !== req.auth.team_id) {
            return res.status(403).json({ success: false, error: "Forbidden" });
        }
        let jobIDs = await (0, crawl_redis_1.getCrawlJobs)(req.params.jobId);
        let jobStatuses = await Promise.all(jobIDs.map(async (x) => [x, await (0, queue_service_1.getScrapeQueue)().getJobState(x)]));
        const throttledJobsSet = new Set(await (0, concurrency_limit_1.getConcurrencyLimitedJobs)(req.auth.team_id));
        const activeJobsSet = new Set(await (0, concurrency_limit_1.getCrawlConcurrencyLimitActiveJobs)(req.params.jobId));
        const validJobStatuses = [];
        const validJobIDs = [];
        for (const [id, status] of jobStatuses) {
            if (throttledJobsSet.has(id)) {
                validJobStatuses.push([id, "prioritized"]);
                validJobIDs.push(id);
            }
            else if (status === "unknown" && activeJobsSet.has(id)) {
                validJobStatuses.push([id, "active"]);
                validJobIDs.push(id);
            }
            else if (status !== "failed" &&
                status !== "unknown") {
                validJobStatuses.push([id, status]);
                validJobIDs.push(id);
            }
        }
        status =
            sc.cancelled
                ? "cancelled"
                : validJobStatuses.every((x) => x[1] === "completed") &&
                    (sc.crawlerOptions
                        ? await (0, crawl_redis_1.isCrawlKickoffFinished)(req.params.jobId)
                        : true)
                    ? "completed"
                    : "scraping";
        // Use validJobIDs instead of jobIDs for further processing
        jobIDs = validJobIDs;
        doneJobsLength = await (0, crawl_redis_1.getDoneJobsOrderedLength)(req.params.jobId);
        doneJobsOrder = await (0, crawl_redis_1.getDoneJobsOrdered)(req.params.jobId, start, end ?? -1);
        totalCount = jobIDs.length;
        if (totalCount === 0 && process.env.USE_DB_AUTHENTICATION === "true") {
            const x = await supabase_1.supabase_rr_service
                .from('firecrawl_jobs')
                .select('*', { count: 'exact', head: true })
                .eq("crawl_id", req.params.jobId)
                .eq("success", true);
            totalCount = x.count ?? 0;
        }
        if (process.env.USE_DB_AUTHENTICATION === "true") {
            const creditsRpc = await supabase_1.supabase_rr_service
                .rpc("credits_billed_by_crawl_id_1", {
                i_crawl_id: req.params.jobId,
            });
            creditsUsed = creditsRpc.data?.[0]?.credits_billed ?? (totalCount * (sc.scrapeOptions?.extract
                ? 5
                : 1));
        }
        else {
            creditsUsed = totalCount * (sc.scrapeOptions?.extract
                ? 5
                : 1);
        }
    }
    else if (process.env.USE_DB_AUTHENTICATION === "true") {
        // TODO: move to read replica
        const { data: scrapeJobCounts, error: scrapeJobError } = await supabase_1.supabase_service
            .rpc("count_jobs_of_crawl_team", { i_crawl_id: req.params.jobId, i_team_id: req.auth.team_id });
        if (scrapeJobError || !scrapeJobCounts || scrapeJobCounts.length === 0) {
            logger_1.logger.error("Error getting scrape job count", { error: scrapeJobError });
            throw scrapeJobError;
        }
        const scrapeJobCount = scrapeJobCounts[0].count ?? 0;
        const { data: crawlJobs, error: crawlJobError } = await supabase_1.supabase_rr_service
            .from("firecrawl_jobs")
            .select("*")
            .eq("job_id", req.params.jobId)
            .limit(1)
            .throwOnError();
        if (crawlJobError) {
            logger_1.logger.error("Error getting crawl job", { error: crawlJobError });
            throw crawlJobError;
        }
        if (!crawlJobs || crawlJobs.length === 0) {
            if (scrapeJobCount === 0) {
                return res.status(404).json({ success: false, error: "Job not found" });
            }
            else {
                status = "completed"; // fake completed to cut the losses
            }
        }
        else {
            status = crawlJobs[0].success ? "completed" : "failed";
        }
        const crawlJob = crawlJobs[0];
        if (crawlJob && crawlJob.team_id !== req.auth.team_id) {
            return res.status(403).json({ success: false, error: "Forbidden" });
        }
        const TEMP_FAIRE_TEAM_ID = "f96ad1a4-8102-4b35-9904-36fd517d3616";
        if (crawlJob
            && crawlJob.team_id !== TEMP_FAIRE_TEAM_ID
            && new Date().valueOf() - new Date(crawlJob.date_added).valueOf() > 24 * 60 * 60 * 1000) {
            return res.status(404).json({ success: false, error: "Job expired" });
        }
        doneJobsLength = scrapeJobCount;
        doneJobsOrder = [];
        const step = 1000;
        let i = 0;
        while (true) {
            const rangeStart = start + (i * step);
            let rangeEnd = start + ((i + 1) * step);
            if (end !== undefined) {
                rangeEnd = Math.min(end, rangeEnd);
            }
            const currentJobs = await supabase_1.supabase_rr_service
                .from("firecrawl_jobs")
                .select("job_id")
                .eq("crawl_id", req.params.jobId)
                .eq("team_id", req.acuc.team_id)
                .order("date_added", { ascending: true })
                .range(rangeStart, rangeEnd)
                .throwOnError();
            const rangeLength = rangeEnd - rangeStart;
            const data = currentJobs.data ?? [];
            doneJobsOrder.push(...data.map(x => x.job_id));
            if (data.length < rangeLength) {
                break;
            }
            if (rangeEnd === end) {
                break;
            }
            i++;
        }
        totalCount = scrapeJobCount ?? 0;
        creditsUsed = crawlJob?.credits_billed ?? totalCount;
    }
    else {
        return res.status(404).json({ success: false, error: "Job not found" });
    }
    let doneJobs = [];
    if (end === undefined) {
        // determine 10 megabyte limit
        let bytes = 0;
        const bytesLimit = 10485760; // 10 MiB in bytes
        const factor = 100; // chunking for faster retrieval
        for (let i = 0; i < doneJobsOrder.length && bytes < bytesLimit; i += factor) {
            // get current chunk and retrieve jobs
            const currentIDs = doneJobsOrder.slice(i, i + factor);
            const jobs = await getJobs(currentIDs);
            // iterate through jobs and add them one them one to the byte counter
            // both loops will break once we cross the byte counter
            for (let ii = 0; ii < jobs.length && bytes < bytesLimit; ii++) {
                const job = jobs[ii];
                const state = await job.getState();
                if (state === "failed" || state === "active") {
                    // TODO: why is active here? race condition? shouldn't matter tho - MG
                    continue;
                }
                if (job.returnvalue === undefined || job.returnvalue === null) {
                    logger_1.logger.warn("Job was considered done, but returnvalue is undefined!", { jobId: job.id, state, returnvalue: job.returnvalue });
                    continue;
                }
                doneJobs.push(job);
                bytes += JSON.stringify(job.returnvalue ?? null).length;
            }
        }
        // if we ran over the bytes limit, remove the last document, except if it's the only document
        if (bytes > bytesLimit && doneJobs.length !== 1) {
            doneJobs.splice(doneJobs.length - 1, 1);
        }
    }
    else {
        doneJobs = (await Promise.all((await getJobs(doneJobsOrder)).map(async (x) => (await x.getState()) === "failed" ? null : x))).filter((x) => x !== null);
    }
    const data = doneJobs.map((x) => x.returnvalue);
    const protocol = process.env.ENV === "local" ? req.protocol : "https";
    const nextURL = new URL(`${protocol}://${req.get("host")}/v1/${isBatch ? "batch/scrape" : "crawl"}/${req.params.jobId}`);
    nextURL.searchParams.set("skip", (start + data.length).toString());
    if (typeof req.query.limit === "string") {
        nextURL.searchParams.set("limit", req.query.limit);
    }
    res.status(200).json({
        success: true,
        status,
        completed: doneJobsLength,
        total: totalCount,
        creditsUsed,
        expiresAt: (await (0, crawl_redis_1.getCrawlExpiry)(req.params.jobId)).toISOString(),
        next: status !== "scraping" && start + data.length === doneJobsLength // if there's not gonna be any documents after this
            ? undefined
            : nextURL.href,
        data: data,
    });
}
//# sourceMappingURL=crawl-status.js.map