"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performExtraction_F0 = performExtraction_F0;
const logger_1 = require("../../logger");
const document_scraper_f0_1 = require("./document-scraper-f0");
const credit_billing_1 = require("../../../services/billing/credit_billing");
const log_job_1 = require("../../../services/logging/log_job");
const spread_schemas_f0_1 = require("./helpers/spread-schemas-f0");
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default();
const extract_redis_1 = require("../extract-redis");
const config_1 = require("../config");
const cached_docs_1 = require("../helpers/cached-docs");
const canonical_url_1 = require("../../canonical-url");
const search_1 = require("../../../search");
const build_prompts_f0_1 = require("./build-prompts-f0");
const url_processor_f0_1 = require("./url-processor-f0");
const llmExtract_f0_1 = require("./llmExtract-f0");
const dereference_schema_f0_1 = require("./helpers/dereference-schema-f0");
const analyzeSchemaAndPrompt_f0_1 = require("./completions/analyzeSchemaAndPrompt-f0");
const checkShouldExtract_f0_1 = require("./completions/checkShouldExtract-f0");
const batchExtract_f0_1 = require("./completions/batchExtract-f0");
const transform_array_to_obj_f0_1 = require("./helpers/transform-array-to-obj-f0");
const deduplicate_objs_array_f0_1 = require("./helpers/deduplicate-objs-array-f0");
const merge_null_val_objs_f0_1 = require("./helpers/merge-null-val-objs-f0");
const mix_schema_objs_f0_1 = require("./helpers/mix-schema-objs-f0");
const singleAnswer_f0_1 = require("./completions/singleAnswer-f0");
const llm_cost_f0_1 = require("./usage/llm-cost-f0");
const source_tracker_f0_1 = require("./helpers/source-tracker-f0");
const auth_1 = require("../../../controllers/auth");
async function performExtraction_F0(extractId, options) {
    const { request, teamId, subId } = options;
    const urlTraces = [];
    let docsMap = new Map();
    let singleAnswerCompletions = null;
    let multiEntityCompletions = [];
    let multiEntityResult = {};
    let singleAnswerResult = {};
    let totalUrlsScraped = 0;
    let sources = {};
    const acuc = await (0, auth_1.getACUCTeam)(teamId);
    const logger = logger_1.logger.child({
        module: "extract",
        method: "performExtraction",
        extractId,
        teamId,
    });
    // If no URLs are provided, generate URLs from the prompt
    if ((!request.urls || request.urls.length === 0) && request.prompt) {
        logger.debug("Generating URLs from prompt...", {
            prompt: request.prompt,
        });
        const rephrasedPrompt = await (0, url_processor_f0_1.generateBasicCompletion_FO)((0, build_prompts_f0_1.buildRephraseToSerpPrompt_F0)(request.prompt));
        const searchResults = await (0, search_1.search)({
            query: rephrasedPrompt.replace('"', "").replace("'", ""),
            num_results: 10,
        });
        request.urls = searchResults.map(result => result.url);
    }
    if (request.urls && request.urls.length === 0) {
        logger.error("No search results found", {
            query: request.prompt,
        });
        (0, log_job_1.logJob)({
            job_id: extractId,
            success: false,
            message: "No search results found",
            num_docs: 1,
            docs: [],
            time_taken: (new Date().getTime() - Date.now()) / 1000,
            team_id: teamId,
            mode: "extract",
            url: request.urls?.join(", ") || "",
            scrapeOptions: request,
            origin: request.origin ?? "api",
            integration: request.integration,
            num_tokens: 0,
            tokens_billed: 0,
            sources,
            zeroDataRetention: false, // not supported
        });
        return {
            success: false,
            error: "No search results found",
            extractId,
        };
    }
    const urls = request.urls || [];
    if (request.__experimental_cacheMode == "load" && request.__experimental_cacheKey && urls) {
        logger.debug("Loading cached docs...");
        try {
            const cache = await (0, cached_docs_1.getCachedDocs)(urls, request.__experimental_cacheKey);
            for (const doc of cache) {
                if (doc.metadata.url) {
                    docsMap.set((0, canonical_url_1.normalizeUrl)(doc.metadata.url), doc);
                }
            }
        }
        catch (error) {
            logger.error("Error loading cached docs", { error });
        }
    }
    // Token tracking
    let tokenUsage = [];
    await (0, extract_redis_1.updateExtract)(extractId, {
        status: "processing",
        steps: [
            {
                step: extract_redis_1.ExtractStep.INITIAL,
                startedAt: Date.now(),
                finishedAt: Date.now(),
                discoveredLinks: request.urls,
            },
        ],
    });
    let startMap = Date.now();
    let aggMapLinks = [];
    logger.debug("Processing URLs...", {
        urlCount: request.urls?.length || 0,
    });
    const urlPromises = urls.map((url) => (0, url_processor_f0_1.processUrl_F0)({
        url,
        prompt: request.prompt,
        teamId,
        allowExternalLinks: request.allowExternalLinks,
        origin: request.origin,
        limit: request.limit,
        includeSubdomains: request.includeSubdomains,
        schema: request.schema,
    }, urlTraces, (links) => {
        aggMapLinks.push(...links);
        (0, extract_redis_1.updateExtract)(extractId, {
            steps: [
                {
                    step: extract_redis_1.ExtractStep.MAP,
                    startedAt: startMap,
                    finishedAt: Date.now(),
                    discoveredLinks: aggMapLinks,
                },
            ],
        });
    }, logger.child({ module: "extract", method: "processUrl", url }), acuc?.flags ?? null));
    const processedUrls = await Promise.all(urlPromises);
    const links = processedUrls.flat().filter((url) => url);
    logger.debug("Processed URLs.", {
        linkCount: links.length,
    });
    if (links.length === 0) {
        logger.error("0 links! Bailing.", {
            linkCount: links.length,
        });
        (0, log_job_1.logJob)({
            job_id: extractId,
            success: false,
            message: "No valid URLs found to scrape",
            num_docs: 1,
            docs: [],
            time_taken: (new Date().getTime() - Date.now()) / 1000,
            team_id: teamId,
            mode: "extract",
            url: request.urls?.join(", ") || "",
            scrapeOptions: request,
            origin: request.origin ?? "api",
            integration: request.integration,
            num_tokens: 0,
            tokens_billed: 0,
            sources,
            zeroDataRetention: false, // not supported
        });
        return {
            success: false,
            error: "No valid URLs found to scrape. Try adjusting your search criteria or including more URLs.",
            extractId,
            urlTrace: urlTraces,
            totalUrlsScraped: 0,
        };
    }
    await (0, extract_redis_1.updateExtract)(extractId, {
        status: "processing",
        steps: [
            {
                step: extract_redis_1.ExtractStep.MAP_RERANK,
                startedAt: startMap,
                finishedAt: Date.now(),
                discoveredLinks: links,
            },
        ],
    });
    let reqSchema = request.schema;
    if (!reqSchema && request.prompt) {
        reqSchema = await (0, llmExtract_f0_1.generateSchemaFromPrompt_F0)(request.prompt);
        logger.debug("Generated request schema.", {
            originalSchema: request.schema,
            schema: reqSchema,
        });
    }
    if (reqSchema) {
        reqSchema = await (0, dereference_schema_f0_1.dereferenceSchema_F0)(reqSchema);
    }
    logger.debug("Transformed schema.", {
        originalSchema: request.schema,
        schema: reqSchema,
    });
    // agent evaluates if the schema or the prompt has an array with big amount of items
    // also it checks if the schema any other properties that are not arrays
    // if so, it splits the results into 2 types of completions:
    // 1. the first one is a completion that will extract the array of items
    // 2. the second one is multiple completions that will extract the items from the array
    let startAnalyze = Date.now();
    const { isMultiEntity, multiEntityKeys, reasoning, keyIndicators, tokenUsage: schemaAnalysisTokenUsage, } = await (0, analyzeSchemaAndPrompt_f0_1.analyzeSchemaAndPrompt_F0)(links, reqSchema, request.prompt ?? "");
    logger.debug("Analyzed schema.", {
        isMultiEntity,
        multiEntityKeys,
        reasoning,
        keyIndicators,
    });
    // Track schema analysis tokens
    tokenUsage.push(schemaAnalysisTokenUsage);
    // console.log("\nIs Multi Entity:", isMultiEntity);
    // console.log("\nMulti Entity Keys:", multiEntityKeys);
    // console.log("\nReasoning:", reasoning);
    // console.log("\nKey Indicators:", keyIndicators);
    let rSchema = reqSchema;
    if (isMultiEntity && reqSchema) {
        logger.debug("=== MULTI-ENTITY ===");
        const { singleAnswerSchema, multiEntitySchema } = await (0, spread_schemas_f0_1.spreadSchemas_F0)(reqSchema, multiEntityKeys);
        rSchema = singleAnswerSchema;
        logger.debug("Spread schemas.", { singleAnswerSchema, multiEntitySchema });
        await (0, extract_redis_1.updateExtract)(extractId, {
            status: "processing",
            steps: [
                {
                    step: extract_redis_1.ExtractStep.MULTI_ENTITY,
                    startedAt: startAnalyze,
                    finishedAt: Date.now(),
                    discoveredLinks: [],
                },
            ],
        });
        const timeout = 60000;
        await (0, extract_redis_1.updateExtract)(extractId, {
            status: "processing",
            steps: [
                {
                    step: extract_redis_1.ExtractStep.MULTI_ENTITY_SCRAPE,
                    startedAt: startAnalyze,
                    finishedAt: Date.now(),
                    discoveredLinks: links,
                },
            ],
        });
        logger.debug("Starting multi-entity scrape...");
        let startScrape = Date.now();
        const scrapePromises = links.map((url) => {
            if (!docsMap.has((0, canonical_url_1.normalizeUrl)(url))) {
                return (0, document_scraper_f0_1.scrapeDocument_F0)({
                    url,
                    teamId,
                    origin: "extract",
                    timeout,
                }, urlTraces, logger.child({
                    module: "extract",
                    method: "scrapeDocument",
                    url,
                    isMultiEntity: true,
                }), {
                    ...request.scrapeOptions,
                    // Needs to be true for multi-entity to work properly
                    onlyMainContent: true,
                });
            }
            return docsMap.get((0, canonical_url_1.normalizeUrl)(url));
        });
        let multyEntityDocs = (await Promise.all(scrapePromises)).filter((doc) => doc !== null);
        logger.debug("Multi-entity scrape finished.", {
            docCount: multyEntityDocs.length,
        });
        totalUrlsScraped += multyEntityDocs.length;
        let endScrape = Date.now();
        await (0, extract_redis_1.updateExtract)(extractId, {
            status: "processing",
            steps: [
                {
                    step: extract_redis_1.ExtractStep.MULTI_ENTITY_SCRAPE,
                    startedAt: startScrape,
                    finishedAt: endScrape,
                    discoveredLinks: links,
                },
            ],
        });
        for (const doc of multyEntityDocs) {
            if (doc?.metadata?.url) {
                docsMap.set((0, canonical_url_1.normalizeUrl)(doc.metadata.url), doc);
            }
        }
        logger.debug("Updated docsMap.", { docsMapSize: docsMap.size }); // useful for error probing
        // Process docs in chunks with queue style processing
        const chunkSize = 50;
        const timeoutCompletion = 45000; // 45 second timeout
        const chunks = [];
        const extractionResults = [];
        // Split into chunks
        for (let i = 0; i < multyEntityDocs.length; i += chunkSize) {
            chunks.push(multyEntityDocs.slice(i, i + chunkSize));
        }
        // Process chunks sequentially with timeout
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (doc) => {
                try {
                    ajv.compile(multiEntitySchema);
                    // Wrap in timeout promise
                    const timeoutPromise = new Promise((resolve) => {
                        setTimeout(() => resolve(null), timeoutCompletion);
                    });
                    // Check if page should be extracted before proceeding
                    const { extract, tokenUsage: shouldExtractCheckTokenUsage } = await (0, checkShouldExtract_f0_1.checkShouldExtract_F0)(request.prompt ?? "", multiEntitySchema, doc);
                    tokenUsage.push(shouldExtractCheckTokenUsage);
                    if (!extract) {
                        logger.info(`Skipping extraction for ${doc.metadata.url} as content is irrelevant`);
                        return null;
                    }
                    // Add confidence score to schema with 5 levels
                    const schemaWithConfidence = {
                        ...multiEntitySchema,
                        properties: {
                            ...multiEntitySchema.properties,
                            is_content_relevant: {
                                type: "boolean",
                                description: "Determine if this content is relevant to the prompt. Return true ONLY if the content contains information that directly helps answer the prompt. Return false if the content is irrelevant or unlikely to contain useful information.",
                            },
                        },
                        required: [
                            ...(multiEntitySchema.required || []),
                            "is_content_relevant",
                        ],
                    };
                    await (0, extract_redis_1.updateExtract)(extractId, {
                        status: "processing",
                        steps: [
                            {
                                step: extract_redis_1.ExtractStep.MULTI_ENTITY_EXTRACT,
                                startedAt: startScrape,
                                finishedAt: Date.now(),
                                discoveredLinks: [
                                    doc.metadata.url || doc.metadata.sourceURL || "",
                                ],
                            },
                        ],
                    });
                    const completionPromise = (0, batchExtract_f0_1.batchExtractPromise_F0)(multiEntitySchema, links, request.prompt ?? "", request.systemPrompt ?? "", doc);
                    // Race between timeout and completion
                    const multiEntityCompletion = (await Promise.race([
                        completionPromise,
                        timeoutPromise,
                    ]));
                    // Track multi-entity extraction tokens
                    if (multiEntityCompletion) {
                        tokenUsage.push(multiEntityCompletion.totalUsage);
                        if (multiEntityCompletion.extract) {
                            return {
                                extract: multiEntityCompletion.extract,
                                url: doc.metadata.url || doc.metadata.sourceURL || ""
                            };
                        }
                    }
                    // console.log(multiEntityCompletion.extract)
                    // if (!multiEntityCompletion.extract?.is_content_relevant) {
                    //   console.log(`Skipping extraction for ${doc.metadata.url} as content is not relevant`);
                    //   return null;
                    // }
                    // Update token usage in traces
                    // if (multiEntityCompletion && multiEntityCompletion.numTokens) {
                    //   const totalLength = docs.reduce(
                    //     (sum, doc) => sum + (doc.markdown?.length || 0),
                    //     0,
                    //   );
                    //   docs.forEach((doc) => {
                    //     if (doc.metadata?.sourceURL) {
                    //       const trace = urlTraces.find(
                    //         (t) => t.url === doc.metadata.sourceURL,
                    //       );
                    //       if (trace && trace.contentStats) {
                    //         trace.contentStats.tokensUsed = Math.floor(
                    //           ((doc.markdown?.length || 0) / totalLength) *
                    //             (multiEntityCompletion?.numTokens || 0),
                    //         );
                    //       }
                    //     }
                    //   });
                    //  }
                    // if (multiEntityCompletion.extract && multiEntityCompletion.extract.extraction_confidence < 3) {
                    //   console.log(`Skipping extraction for ${doc.metadata.url} as confidence is too low (${multiEntityCompletion.extract.extraction_confidence})`);
                    //   return null;
                    // }
                    return null;
                }
                catch (error) {
                    logger.error(`Failed to process document.`, {
                        error,
                        url: doc.metadata.url ?? doc.metadata.sourceURL,
                    });
                    return null;
                }
            });
            // Wait for current chunk to complete before processing next chunk
            const chunkResults = await Promise.all(chunkPromises);
            const validResults = chunkResults.filter((result) => result !== null);
            extractionResults.push(...validResults);
            multiEntityCompletions.push(...validResults.map(r => r.extract));
            logger.debug("All multi-entity completion chunks finished.", {
                completionCount: multiEntityCompletions.length,
            });
        }
        try {
            // Use SourceTracker to handle source tracking
            const sourceTracker = new source_tracker_f0_1.SourceTracker_F0();
            // Transform and merge results while preserving sources
            sourceTracker.transformResults_F0(extractionResults, multiEntitySchema, false);
            multiEntityResult = (0, transform_array_to_obj_f0_1.transformArrayToObject_F0)(multiEntitySchema, multiEntityCompletions);
            // Track sources before deduplication
            sourceTracker.trackPreDeduplicationSources_F0(multiEntityResult);
            // Apply deduplication and merge
            multiEntityResult = (0, deduplicate_objs_array_f0_1.deduplicateObjectsArray_F0)(multiEntityResult);
            multiEntityResult = (0, merge_null_val_objs_f0_1.mergeNullValObjs_F0)(multiEntityResult);
            // Map sources to final deduplicated/merged items
            const multiEntitySources = sourceTracker.mapSourcesToFinalItems_F0(multiEntityResult, multiEntityKeys);
            Object.assign(sources, multiEntitySources);
        }
        catch (error) {
            logger.error(`Failed to transform array to object`, { error });
            (0, log_job_1.logJob)({
                job_id: extractId,
                success: false,
                message: "Failed to transform array to object",
                num_docs: 1,
                docs: [],
                time_taken: (new Date().getTime() - Date.now()) / 1000,
                team_id: teamId,
                mode: "extract",
                url: request.urls?.join(", ") || "",
                scrapeOptions: request,
                origin: request.origin ?? "api",
                integration: request.integration,
                num_tokens: 0,
                tokens_billed: 0,
                sources,
                zeroDataRetention: false, // not supported
            });
            return {
                success: false,
                error: "An unexpected error occurred. Please contact help@firecrawl.com for help.",
                extractId,
                urlTrace: urlTraces,
                totalUrlsScraped,
            };
        }
    }
    if (rSchema &&
        Object.keys(rSchema).length > 0 &&
        rSchema.properties &&
        Object.keys(rSchema.properties).length > 0) {
        logger.debug("=== SINGLE PAGES ===", {
            linkCount: links.length,
            schema: rSchema,
        });
        // Scrape documents
        const timeout = 60000;
        let singleAnswerDocs = [];
        // let rerank = await rerankLinks(links.map((url) => ({ url })), request.prompt ?? JSON.stringify(request.schema), urlTraces);
        await (0, extract_redis_1.updateExtract)(extractId, {
            status: "processing",
            steps: [
                {
                    step: extract_redis_1.ExtractStep.SCRAPE,
                    startedAt: Date.now(),
                    finishedAt: Date.now(),
                    discoveredLinks: links,
                },
            ],
        });
        const scrapePromises = links.map((url) => {
            if (!docsMap.has((0, canonical_url_1.normalizeUrl)(url))) {
                return (0, document_scraper_f0_1.scrapeDocument_F0)({
                    url,
                    teamId,
                    origin: "extract",
                    timeout,
                }, urlTraces, logger.child({
                    module: "extract",
                    method: "scrapeDocument",
                    url,
                    isMultiEntity: false,
                }), request.scrapeOptions);
            }
            return docsMap.get((0, canonical_url_1.normalizeUrl)(url));
        });
        try {
            const results = await Promise.all(scrapePromises);
            for (const doc of results) {
                if (doc?.metadata?.url) {
                    docsMap.set((0, canonical_url_1.normalizeUrl)(doc.metadata.url), doc);
                }
            }
            logger.debug("Updated docsMap.", { docsMapSize: docsMap.size }); // useful for error probing
            const validResults = results.filter((doc) => doc !== null);
            singleAnswerDocs.push(...validResults);
            totalUrlsScraped += validResults.length;
            logger.debug("Scrapes finished.", { docCount: validResults.length });
        }
        catch (error) {
            logger.error("Failed to scrape documents", { error });
            (0, log_job_1.logJob)({
                job_id: extractId,
                success: false,
                message: "Failed to scrape documents",
                num_docs: 1,
                docs: [],
                time_taken: (new Date().getTime() - Date.now()) / 1000,
                team_id: teamId,
                mode: "extract",
                url: request.urls?.join(", ") || "",
                scrapeOptions: request,
                origin: request.origin ?? "api",
                integration: request.integration,
                num_tokens: 0,
                tokens_billed: 0,
                sources,
                zeroDataRetention: false, // not supported
            });
            return {
                success: false,
                error: error.message,
                extractId,
                urlTrace: urlTraces,
                totalUrlsScraped,
            };
        }
        if (docsMap.size == 0) {
            // All urls are invalid
            logger.error("All provided URLs are invalid!");
            (0, log_job_1.logJob)({
                job_id: extractId,
                success: false,
                message: "All provided URLs are invalid",
                num_docs: 1,
                docs: [],
                time_taken: (new Date().getTime() - Date.now()) / 1000,
                team_id: teamId,
                mode: "extract",
                url: request.urls?.join(", ") || "",
                scrapeOptions: request,
                origin: request.origin ?? "api",
                integration: request.integration,
                num_tokens: 0,
                tokens_billed: 0,
                sources,
                zeroDataRetention: false, // not supported
            });
            return {
                success: false,
                error: "All provided URLs are invalid. Please check your input and try again.",
                extractId,
                urlTrace: request.urlTrace ? urlTraces : undefined,
                totalUrlsScraped: 0,
            };
        }
        await (0, extract_redis_1.updateExtract)(extractId, {
            status: "processing",
            steps: [
                {
                    step: extract_redis_1.ExtractStep.EXTRACT,
                    startedAt: Date.now(),
                    finishedAt: Date.now(),
                    discoveredLinks: links,
                },
            ],
        });
        // Generate completions
        logger.debug("Generating singleAnswer completions...");
        let { extract: completionResult, tokenUsage: singleAnswerTokenUsage, sources: singleAnswerSources } = await (0, singleAnswer_f0_1.singleAnswerCompletion_F0)({
            singleAnswerDocs,
            rSchema,
            links,
            prompt: request.prompt ?? "",
            systemPrompt: request.systemPrompt ?? ""
        });
        logger.debug("Done generating singleAnswer completions.");
        // Track single answer extraction tokens and sources
        if (completionResult) {
            tokenUsage.push(singleAnswerTokenUsage);
            // Add sources for top-level properties in single answer
            if (rSchema?.properties) {
                Object.keys(rSchema.properties).forEach(key => {
                    if (completionResult[key] !== undefined) {
                        sources[key] = singleAnswerSources || singleAnswerDocs.map(doc => doc.metadata.url || doc.metadata.sourceURL || "");
                    }
                });
            }
        }
        singleAnswerResult = completionResult;
        singleAnswerCompletions = singleAnswerResult;
        // Update token usage in traces
        // if (completions && completions.numTokens) {
        //   const totalLength = docs.reduce(
        //     (sum, doc) => sum + (doc.markdown?.length || 0),
        //     0,
        //   );
        //   docs.forEach((doc) => {
        //     if (doc.metadata?.sourceURL) {
        //       const trace = urlTraces.find((t) => t.url === doc.metadata.sourceURL);
        //       if (trace && trace.contentStats) {
        //         trace.contentStats.tokensUsed = Math.floor(
        //           ((doc.markdown?.length || 0) / totalLength) *
        //             (completions?.numTokens || 0),
        //         );
        //       }
        //     }
        //   });
        // }
    }
    let finalResult = reqSchema
        ? await (0, mix_schema_objs_f0_1.mixSchemaObjects_F0)(reqSchema, singleAnswerResult, multiEntityResult, logger.child({ method: "mixSchemaObjects" }))
        : singleAnswerResult || multiEntityResult;
    // Tokenize final result to get token count
    // let finalResultTokens = 0;
    // if (finalResult) {
    //   const finalResultStr = JSON.stringify(finalResult);
    //   finalResultTokens = numTokensFromString(finalResultStr, "gpt-4o");
    // }
    // // Deduplicate and validate final result against schema
    // if (reqSchema && finalResult && finalResult.length <= extractConfig.DEDUPLICATION.MAX_TOKENS) {
    //   const schemaValidation = await generateCompletions(
    //     logger.child({ method: "extractService/validateAndDeduplicate" }),
    //     {
    //       mode: "llm",
    //       systemPrompt: `You are a data validator and deduplicator. Your task is to:
    //       1. Remove any duplicate entries in the data extracted by merging that into a single object according to the provided shcema
    //       2. Ensure all data matches the provided schema
    //       3. Keep only the highest quality and most complete entries when duplicates are found.
    //       Do not change anything else. If data is null keep it null. If the schema is not provided, return the data as is.`,
    //       prompt: `Please validate and merge the duplicate entries in this data according to the schema provided:\n
    //       <start of extract data>
    //       ${JSON.stringify(finalResult)}
    //       <end of extract data>
    //       <start of schema>
    //       ${JSON.stringify(reqSchema)}
    //       <end of schema>
    //       `,
    //       schema: reqSchema,
    //     },
    //     undefined,
    //     undefined,
    //     true,
    //     "gpt-4o"
    //   );
    //   console.log("schemaValidation", schemaValidation);
    //   console.log("schemaValidation", finalResult);
    //   if (schemaValidation?.extract) {
    //     tokenUsage.push(schemaValidation.totalUsage);
    //     finalResult = schemaValidation.extract;
    //   }
    // }
    const totalTokensUsed = tokenUsage.reduce((a, b) => a + b.totalTokens, 0);
    const llmUsage = (0, llm_cost_f0_1.estimateTotalCost_F0)(tokenUsage);
    let tokensToBill = (0, llm_cost_f0_1.calculateFinalResultCost_F0)(finalResult);
    if (config_1.CUSTOM_U_TEAMS.includes(teamId)) {
        tokensToBill = 1;
    }
    // Bill team for usage
    (0, credit_billing_1.billTeam)(teamId, subId, tokensToBill, logger, true).catch((error) => {
        logger.error(`Failed to bill team ${teamId} for ${tokensToBill} tokens: ${error}`);
    });
    // Log job with token usage and sources
    (0, log_job_1.logJob)({
        job_id: extractId,
        success: true,
        message: "Extract completed",
        num_docs: 1,
        docs: finalResult ?? {},
        time_taken: (new Date().getTime() - Date.now()) / 1000,
        team_id: teamId,
        mode: "extract",
        url: request.urls?.join(", ") || "",
        scrapeOptions: request,
        origin: request.origin ?? "api",
        integration: request.integration,
        num_tokens: totalTokensUsed,
        tokens_billed: tokensToBill,
        sources,
        zeroDataRetention: false, // not supported
    }).then(() => {
        (0, extract_redis_1.updateExtract)(extractId, {
            status: "completed",
            llmUsage,
            sources,
            tokensBilled: tokensToBill,
        }).catch((error) => {
            logger.error(`Failed to update extract ${extractId} status to completed: ${error}`);
        });
    });
    logger.debug("Done!");
    if (request.__experimental_cacheMode == "save" && request.__experimental_cacheKey) {
        logger.debug("Saving cached docs...");
        try {
            await (0, cached_docs_1.saveCachedDocs)([...docsMap.values()], request.__experimental_cacheKey);
        }
        catch (error) {
            logger.error("Error saving cached docs", { error });
        }
    }
    return {
        success: true,
        data: finalResult ?? {},
        extractId,
        warning: undefined,
        urlTrace: request.urlTrace ? urlTraces : undefined,
        llmUsage,
        totalUrlsScraped,
        sources,
    };
}
//# sourceMappingURL=extraction-service-f0.js.map