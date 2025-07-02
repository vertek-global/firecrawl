"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveJobToGCS = saveJobToGCS;
exports.getJobFromGCS = getJobFromGCS;
exports.removeJobFromGCS = removeJobFromGCS;
exports.getDocFromGCS = getDocFromGCS;
const storage_1 = require("@google-cloud/storage");
const logger_1 = require("./logger");
const credentials = process.env.GCS_CREDENTIALS ? JSON.parse(atob(process.env.GCS_CREDENTIALS)) : undefined;
const storage = new storage_1.Storage({ credentials });
async function saveJobToGCS(job) {
    try {
        if (!process.env.GCS_BUCKET_NAME) {
            return;
        }
        const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
        const blob = bucket.file(`${job.job_id}.json`);
        for (let i = 0; i < 3; i++) {
            try {
                await blob.save(JSON.stringify(job.docs), {
                    contentType: "application/json",
                });
                break;
            }
            catch (error) {
                if (i === 2) {
                    throw error;
                }
                else {
                    logger_1.logger.error(`Error saving job to GCS, retrying`, {
                        error,
                        scrapeId: job.job_id,
                        jobId: job.job_id,
                        i,
                    });
                }
            }
        }
        for (let i = 0; i < 3; i++) {
            try {
                await blob.setMetadata({
                    metadata: {
                        job_id: job.job_id ?? null,
                        success: job.success,
                        message: job.message ?? null,
                        num_docs: job.num_docs,
                        time_taken: job.time_taken,
                        team_id: (job.team_id === "preview" || job.team_id?.startsWith("preview_")) ? null : job.team_id,
                        mode: job.mode,
                        url: job.url,
                        crawler_options: JSON.stringify(job.crawlerOptions),
                        page_options: JSON.stringify(job.scrapeOptions),
                        origin: job.origin,
                        integration: job.integration ?? null,
                        num_tokens: job.num_tokens ?? null,
                        retry: !!job.retry,
                        crawl_id: job.crawl_id ?? null,
                        tokens_billed: job.tokens_billed ?? null,
                    },
                });
                break;
            }
            catch (error) {
                if (i === 2) {
                    throw error;
                }
                else {
                    logger_1.logger.error(`Error saving job metadata to GCS, retrying`, {
                        error,
                        scrapeId: job.job_id,
                        jobId: job.job_id,
                        i,
                    });
                }
            }
        }
    }
    catch (error) {
        logger_1.logger.error(`Error saving job to GCS`, {
            error,
            scrapeId: job.job_id,
            jobId: job.job_id,
        });
    }
}
async function getJobFromGCS(jobId) {
    try {
        if (!process.env.GCS_BUCKET_NAME) {
            return null;
        }
        const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
        const blob = bucket.file(`${jobId}.json`);
        const [content] = await blob.download();
        const x = JSON.parse(content.toString());
        return x;
    }
    catch (error) {
        if (error instanceof storage_1.ApiError && error.code === 404 && error.message.includes("No such object:")) {
            // Object does not exist
            return null;
        }
        logger_1.logger.error(`Error getting job from GCS`, {
            error,
            jobId,
            scrapeId: jobId,
        });
        return null;
    }
}
async function removeJobFromGCS(jobId) {
    try {
        if (!process.env.GCS_BUCKET_NAME) {
            return;
        }
        const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
        const blob = bucket.file(`${jobId}.json`);
        await blob.delete({
            ignoreNotFound: true,
        });
    }
    catch (error) {
        if (error instanceof storage_1.ApiError && error.code === 404 && error.message.includes("No such object:")) {
            // Object does not exist
            return;
        }
        logger_1.logger.error(`Error removing job from GCS`, {
            error,
            jobId,
            scrapeId: jobId,
        });
    }
}
// TODO: fix the any type (we have multiple Document types in the codebase)
async function getDocFromGCS(url) {
    //   logger.info(`Getting f-engine document from GCS`, {
    //     url,
    //   });
    try {
        if (!process.env.GCS_FIRE_ENGINE_BUCKET_NAME) {
            return null;
        }
        const bucket = storage.bucket(process.env.GCS_FIRE_ENGINE_BUCKET_NAME);
        const blob = bucket.file(`${url}`);
        const [exists] = await blob.exists();
        if (!exists) {
            return null;
        }
        const [blobContent] = await blob.download();
        const parsed = JSON.parse(blobContent.toString());
        return parsed;
    }
    catch (error) {
        logger_1.logger.error(`Error getting f-engine document from GCS`, {
            error,
            url,
        });
        return null;
    }
}
//# sourceMappingURL=gcs-jobs.js.map