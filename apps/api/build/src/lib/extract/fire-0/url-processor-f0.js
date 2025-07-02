"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBasicCompletion_FO = generateBasicCompletion_FO;
exports.processUrl_F0 = processUrl_F0;
const map_1 = require("../../../controllers/v1/map");
const validateUrl_1 = require("../../validateUrl");
const blocklist_1 = require("../../../scraper/WebScraper/utils/blocklist");
const build_prompts_1 = require("../build-prompts");
const reranker_f0_1 = require("./reranker-f0");
const config_1 = require("../config");
const ai_1 = require("ai");
const generic_ai_1 = require("../../generic-ai");
const extraction_service_1 = require("../extraction-service");
async function generateBasicCompletion_FO(prompt) {
    const { text } = await (0, ai_1.generateText)({
        model: (0, generic_ai_1.getModel)("gpt-4o"),
        prompt: prompt,
        temperature: 0
    });
    return text;
}
async function processUrl_F0(options, urlTraces, updateExtractCallback, logger, teamFlags) {
    const trace = {
        url: options.url,
        status: "mapped",
        timing: {
            discoveredAt: new Date().toISOString(),
        },
    };
    urlTraces.push(trace);
    if (!options.url.includes("/*") && !options.allowExternalLinks) {
        if (!(0, blocklist_1.isUrlBlocked)(options.url, teamFlags)) {
            trace.usedInCompletion = true;
            return [options.url];
        }
        logger.warn("URL is blocked");
        trace.status = "error";
        trace.error = "URL is blocked";
        trace.usedInCompletion = false;
        return [];
    }
    const baseUrl = options.url.replace("/*", "");
    let urlWithoutWww = baseUrl.replace("www.", "");
    let searchQuery = options.prompt;
    if (options.prompt) {
        searchQuery =
            (await generateBasicCompletion_FO((0, build_prompts_1.buildRefrasedPrompt)(options.prompt, baseUrl)))
                ?.replace('"', "")
                .replace("/", "") ?? options.prompt;
    }
    try {
        logger.debug("Running map...", {
            search: searchQuery,
        });
        const mapResults = await (0, map_1.getMapResults)({
            url: baseUrl,
            search: searchQuery,
            teamId: options.teamId,
            allowExternalLinks: options.allowExternalLinks,
            origin: options.origin,
            limit: options.limit,
            ignoreSitemap: false,
            includeMetadata: true,
            includeSubdomains: options.includeSubdomains,
            flags: teamFlags,
        });
        let mappedLinks = mapResults.mapResults;
        let allUrls = [...mappedLinks.map((m) => m.url), ...mapResults.links];
        let uniqueUrls = (0, validateUrl_1.removeDuplicateUrls)(allUrls);
        logger.debug("Map finished.", {
            linkCount: allUrls.length,
            uniqueLinkCount: uniqueUrls.length,
        });
        // Track all discovered URLs
        uniqueUrls.forEach((discoveredUrl) => {
            if (!urlTraces.some((t) => t.url === discoveredUrl)) {
                urlTraces.push({
                    url: discoveredUrl,
                    status: "mapped",
                    timing: {
                        discoveredAt: new Date().toISOString(),
                    },
                    usedInCompletion: false,
                });
            }
        });
        // retry if only one url is returned
        if (uniqueUrls.length <= 1) {
            logger.debug("Running map... (pass 2)");
            const retryMapResults = await (0, map_1.getMapResults)({
                url: baseUrl,
                teamId: options.teamId,
                allowExternalLinks: options.allowExternalLinks,
                origin: options.origin,
                limit: options.limit,
                ignoreSitemap: false,
                includeMetadata: true,
                includeSubdomains: options.includeSubdomains,
                flags: teamFlags,
            });
            mappedLinks = retryMapResults.mapResults;
            allUrls = [...mappedLinks.map((m) => m.url), ...mapResults.links];
            uniqueUrls = (0, validateUrl_1.removeDuplicateUrls)(allUrls);
            logger.debug("Map finished. (pass 2)", {
                linkCount: allUrls.length,
                uniqueLinkCount: uniqueUrls.length,
            });
            // Track all discovered URLs
            uniqueUrls.forEach((discoveredUrl) => {
                if (!urlTraces.some((t) => t.url === discoveredUrl)) {
                    urlTraces.push({
                        url: discoveredUrl,
                        status: "mapped",
                        warning: "Broader search. Not limiting map results to prompt.",
                        timing: {
                            discoveredAt: new Date().toISOString(),
                        },
                        usedInCompletion: false,
                    });
                }
            });
        }
        // Track all discovered URLs
        uniqueUrls.forEach((discoveredUrl) => {
            if (!urlTraces.some((t) => t.url === discoveredUrl)) {
                urlTraces.push({
                    url: discoveredUrl,
                    status: "mapped",
                    timing: {
                        discoveredAt: new Date().toISOString(),
                    },
                    usedInCompletion: false,
                });
            }
        });
        const existingUrls = new Set(mappedLinks.map((m) => m.url));
        const newUrls = uniqueUrls.filter((url) => !existingUrls.has(url));
        mappedLinks = [
            ...mappedLinks,
            ...newUrls.map((url) => ({ url, title: "", description: "" })),
        ];
        if (mappedLinks.length === 0) {
            mappedLinks = [{ url: baseUrl, title: "", description: "" }];
        }
        // Limit initial set of links (1000)
        mappedLinks = mappedLinks.slice(0, config_1.extractConfig.RERANKING.MAX_INITIAL_RANKING_LIMIT);
        updateExtractCallback(mappedLinks.map((x) => x.url));
        let rephrasedPrompt = options.prompt ?? searchQuery;
        try {
            rephrasedPrompt =
                (await generateBasicCompletion_FO((0, build_prompts_1.buildPreRerankPrompt)(rephrasedPrompt, options.schema, baseUrl))) ??
                    "Extract the data according to the schema: " +
                        JSON.stringify(options.schema, null, 2);
        }
        catch (error) {
            console.error("Error generating search query from schema:", error);
            rephrasedPrompt =
                "Extract the data according to the schema: " +
                    JSON.stringify(options.schema, null, 2) +
                    " " +
                    options?.prompt; // Fallback to just the domain
        }
        //   "mapped-links.txt",
        //   mappedLinks,
        //   (link, index) => `${index + 1}. URL: ${link.url}, Title: ${link.title}, Description: ${link.description}`
        // );
        logger.info("Generated rephrased prompt.", {
            rephrasedPrompt,
        });
        logger.info("Reranking pass 1 (threshold 0.8)...");
        const rerankerResult = await (0, reranker_f0_1.rerankLinksWithLLM_F0)({
            links: mappedLinks,
            searchQuery: rephrasedPrompt,
            urlTraces,
        }, new extraction_service_1.CostTracking());
        mappedLinks = rerankerResult.mapDocument;
        let tokensUsed = rerankerResult.tokensUsed;
        logger.info("Reranked! (pass 1)", {
            linkCount: mappedLinks.length,
        });
        // 2nd Pass, useful for when the first pass returns too many links
        if (mappedLinks.length > 100) {
            logger.info("Reranking (pass 2)...");
            const rerankerResult = await (0, reranker_f0_1.rerankLinksWithLLM_F0)({
                links: mappedLinks,
                searchQuery: rephrasedPrompt,
                urlTraces,
            }, new extraction_service_1.CostTracking());
            mappedLinks = rerankerResult.mapDocument;
            tokensUsed += rerankerResult.tokensUsed;
            logger.info("Reranked! (pass 2)", {
                linkCount: mappedLinks.length,
            });
        }
        // dumpToFile(
        //   "llm-links.txt",
        //   mappedLinks,
        //   (link, index) => `${index + 1}. URL: ${link.url}, Title: ${link.title}, Description: ${link.description}`
        // );
        // Remove title and description from mappedLinks
        mappedLinks = mappedLinks.map((link) => ({ url: link.url }));
        return mappedLinks.map((x) => x.url);
    }
    catch (error) {
        trace.status = "error";
        trace.error = error.message;
        trace.usedInCompletion = false;
        return [];
    }
}
//# sourceMappingURL=url-processor-f0.js.map