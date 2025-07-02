"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartScrape = smartScrape;
const zod_1 = require("zod");
const logger_1 = require("../../../lib/logger");
const fetch_1 = require("./fetch");
const dotenv_1 = require("dotenv");
const extraction_service_1 = require("../../../lib/extract/extraction-service");
(0, dotenv_1.configDotenv)();
// Define schemas outside the function scope
const tokenUsageDetailSchema = zod_1.z.object({
    input_tokens: zod_1.z.number().int(),
    output_tokens: zod_1.z.number().int(),
    total_cost: zod_1.z.number().nullable(), // Allows number or null
});
// Schema for an individual scraped page object
const scrapedPageSchema = zod_1.z.object({
    html: zod_1.z.string(),
    reason: zod_1.z.string(),
    page: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
});
// Main schema for the structure returned by the smart-scrape endpoint
const smartScrapeResultSchema = zod_1.z.object({
    sessionId: zod_1.z.string(),
    success: zod_1.z.boolean(),
    scrapedPages: zod_1.z.array(scrapedPageSchema),
    tokenUsage: zod_1.z.number(),
    // z.record(
    //   z.string(), // Key is the model name (string)
    //   tokenUsageDetailSchema, // Value matches the detail schema
    // ),
});
/**
 * Sends a POST request to the internal /smart-scrape endpoint to extract
 * structured data from a URL based on a prompt.
 *
 * @param url The URL of the page to scrape.
 * @param prompt The prompt guiding the data extraction.
 * @returns A promise that resolves to an object matching the SmartScrapeResult type.
 * @throws Throws an error if the request fails or the response is invalid.
 */
async function smartScrape({ url, prompt, sessionId, extractId, scrapeId, beforeSubmission, costTracking, }) {
    let logger = logger_1.logger.child({
        method: "smartScrape",
        module: "smartScrape",
        extractId,
        url,
        prompt,
        sessionId,
        scrapeId,
    });
    try {
        logger.info("Initiating smart scrape request");
        // Pass schema type as generic parameter to robustFeth
        const response = await (0, fetch_1.robustFetch)({
            url: `${process.env.SMART_SCRAPE_API_URL}/smart-scrape`,
            method: "POST",
            body: {
                url,
                prompt,
                userProvidedId: sessionId ?? undefined,
                extractId,
                scrapeId,
                models: {
                    thinkingModel: {
                        model: "gemini-2.5-pro",
                        provider: "vertex",
                        supportTools: true,
                        toolChoice: "required",
                        cost: {
                            input: 1.3,
                            output: 5,
                        },
                    },
                    toolModel: {
                        model: "gemini-2.0-flash",
                        provider: "google",
                    },
                },
            },
            schema: smartScrapeResultSchema, // Pass the schema instance for validation
            logger,
            mock: null, // Keep mock null if not mocking
        });
        // Check if the response indicates a 500 error
        // Use type assertion to handle the error response structure
        const errorResponse = response;
        if (errorResponse &&
            errorResponse.success === false &&
            errorResponse.error) {
            if (errorResponse.tokenUsage) {
                logger.info("Failed smart scrape cost $" + errorResponse.tokenUsage);
                costTracking.addCall({
                    type: "smartScrape",
                    cost: errorResponse.tokenUsage,
                    model: "firecrawl/smart-scrape",
                    metadata: {
                        module: "smartScrape",
                        method: "smartScrape",
                        url,
                        sessionId,
                    },
                });
            }
            if (errorResponse.error === "Cost limit exceeded") {
                throw new extraction_service_1.CostLimitExceededError();
            }
            logger.error("Smart scrape returned error response", {
                url,
                prompt,
                error: errorResponse.error,
                details: errorResponse.details || "No details provided",
            });
            throw new Error(`Smart scrape failed: ${errorResponse.error}${errorResponse.details ? ` - ${errorResponse.details}` : ""}`);
        }
        logger.info("Smart scrape successful", {
            sessionId: response.sessionId,
        });
        logger.info("Smart scrape cost $" + response.tokenUsage);
        costTracking.addCall({
            type: "smartScrape",
            cost: response.tokenUsage,
            model: "firecrawl/smart-scrape",
            metadata: {
                module: "smartScrape",
                method: "smartScrape",
                url,
                sessionId,
            },
        });
        return response; // The response type now matches SmartScrapeResult
    }
    catch (error) {
        if (error instanceof extraction_service_1.CostLimitExceededError) {
            throw error;
        }
        if (error instanceof Error && error.message === "Request sent failure status" && error.cause && error.cause.response) {
            const response = error.cause.response;
            try {
                const json = JSON.parse(response.body);
                if (json.tokenUsage) {
                    logger.info("Failed smart scrape cost $" + json.tokenUsage);
                    costTracking.addCall({
                        type: "smartScrape",
                        cost: json.tokenUsage,
                        model: "firecrawl/smart-scrape",
                        metadata: {
                            module: "smartScrape",
                            method: "smartScrape",
                            url,
                            sessionId,
                        },
                    });
                }
                if (json.error === "Cost limit exceeded") {
                    throw new extraction_service_1.CostLimitExceededError();
                }
            }
            catch (e) { }
        }
        // Safely extract error information without circular references
        const errorInfo = {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : "Unknown",
            stack: error instanceof Error ? error.stack : undefined,
            // Extract cause safely if it exists
            cause: error instanceof Error && error.cause
                ? error.cause instanceof Error
                    ? {
                        message: error.cause.message,
                        name: error.cause.name,
                        stack: error.cause.stack,
                    }
                    : typeof error.cause === "object"
                        ? {
                            ...Object.fromEntries(Object.entries(error.cause).filter(([_, v]) => v !== null && typeof v !== "object")),
                            error: error.cause?.error?.message ||
                                error.cause?.error,
                        }
                        : String(error.cause)
                : undefined,
        };
        logger.error("Smart scrape request failed", {
            error: errorInfo
        });
        // Rethrowing the error to be handled by the caller
        throw new Error(`Failed to smart scrape URL: ${url}`, { cause: error });
    }
}
//# sourceMappingURL=smartScrape.js.map