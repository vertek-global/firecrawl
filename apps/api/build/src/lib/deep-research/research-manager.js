"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchLLMService = exports.ResearchStateManager = void 0;
const deep_research_redis_1 = require("./deep-research-redis");
const llmExtract_1 = require("../../scraper/scrapeURL/transformers/llmExtract");
const generic_ai_1 = require("../generic-ai");
class ResearchStateManager {
    researchId;
    teamId;
    maxDepth;
    logger;
    topic;
    findings = [];
    summaries = [];
    nextSearchTopic = "";
    urlToSearch = "";
    currentDepth = 0;
    failedAttempts = 0;
    maxFailedAttempts = 3;
    completedSteps = 0;
    totalExpectedSteps;
    seenUrls = new Set();
    sources = [];
    constructor(researchId, teamId, maxDepth, logger, topic) {
        this.researchId = researchId;
        this.teamId = teamId;
        this.maxDepth = maxDepth;
        this.logger = logger;
        this.topic = topic;
        this.totalExpectedSteps = maxDepth * 5; // 5 steps per depth level
        this.nextSearchTopic = topic;
    }
    hasSeenUrl(url) {
        return this.seenUrls.has(url);
    }
    addSeenUrl(url) {
        this.seenUrls.add(url);
    }
    getSeenUrls() {
        return this.seenUrls;
    }
    async addActivity(activities) {
        if (activities.some((activity) => activity.status === "complete")) {
            this.completedSteps++;
        }
        await (0, deep_research_redis_1.updateDeepResearch)(this.researchId, {
            activities: activities,
            completedSteps: this.completedSteps,
        });
    }
    async addSources(sources) {
        await (0, deep_research_redis_1.updateDeepResearch)(this.researchId, {
            sources: sources,
        });
    }
    async addFindings(findings) {
        // Only keep the most recent 50 findings
        // To avoid memory issues for now
        this.findings = [...this.findings, ...findings].slice(-50);
        await (0, deep_research_redis_1.updateDeepResearch)(this.researchId, {
            findings: findings,
        });
    }
    async addSummary(summary) {
        this.summaries.push(summary);
        await (0, deep_research_redis_1.updateDeepResearch)(this.researchId, {
            summaries: [summary],
        });
    }
    async incrementDepth() {
        this.currentDepth++;
        await (0, deep_research_redis_1.updateDeepResearch)(this.researchId, {
            currentDepth: this.currentDepth,
        });
    }
    incrementFailedAttempts() {
        this.failedAttempts++;
    }
    getFindings() {
        return this.findings;
    }
    getSummaries() {
        return this.summaries;
    }
    getCurrentDepth() {
        return this.currentDepth;
    }
    hasReachedMaxDepth() {
        return this.currentDepth >= this.maxDepth;
    }
    hasReachedMaxFailedAttempts() {
        return this.failedAttempts >= this.maxFailedAttempts;
    }
    getProgress() {
        return {
            completedSteps: this.completedSteps,
            totalSteps: this.totalExpectedSteps,
        };
    }
    setNextSearchTopic(topic) {
        this.nextSearchTopic = topic;
    }
    getNextSearchTopic() {
        return this.nextSearchTopic;
    }
    setUrlToSearch(url) {
        this.urlToSearch = url;
    }
    getUrlToSearch() {
        return this.urlToSearch;
    }
    getSources() {
        return this.sources;
    }
}
exports.ResearchStateManager = ResearchStateManager;
class ResearchLLMService {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async generateSearchQueries(topic, findings = [], costTracking) {
        const { extract } = await (0, llmExtract_1.generateCompletions)({
            logger: this.logger.child({
                method: "generateSearchQueries",
            }),
            options: {
                mode: "llm",
                systemPrompt: "You are an expert research agent that generates search queries (SERP) to explore topics deeply and thoroughly. Do not generate repeated queries. Today's date is " +
                    new Date().toISOString().split("T")[0],
                schema: {
                    type: "object",
                    properties: {
                        queries: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    query: {
                                        type: "string",
                                        description: "The search query to use",
                                    },
                                    researchGoal: {
                                        type: "string",
                                        description: "The specific goal this query aims to achieve and how it advances the research",
                                    },
                                },
                            },
                        },
                    },
                },
                prompt: `Generate a list of 3-5 search queries to deeply research this topic: "${topic}"
          ${findings.length > 0 ? `\nBased on these previous findings, generate more specific queries:\n${(0, llmExtract_1.trimToTokenLimit)(findings.map((f) => `- ${f.text}`).join("\n"), 10000).text}` : ""}
          
          Each query should be specific and focused on a particular aspect.
          Build upon previous findings when available.
          Be specific and go deep, not wide - always following the original topic.
          Every search query is a new SERP query so make sure the whole context is added without overwhelming the search engine.
          The first SERP query you generate should be a very concise, simple version of the topic. `,
            },
            markdown: "",
            costTrackingOptions: {
                costTracking,
                metadata: {
                    module: "deep-research",
                    method: "generateSearchQueries",
                },
            },
        });
        return extract.queries;
    }
    async analyzeAndPlan(findings, currentTopic, timeRemaining, systemPrompt, costTracking) {
        try {
            const timeRemainingMinutes = Math.round((timeRemaining / 1000 / 60) * 10) / 10;
            const { extract } = await (0, llmExtract_1.generateCompletions)({
                logger: this.logger.child({
                    method: "analyzeAndPlan",
                }),
                options: {
                    mode: "llm",
                    systemPrompt: systemPrompt +
                        "You are an expert research agent that is analyzing findings. Your goal is to synthesize information and identify gaps for further research. Today's date is " +
                        new Date().toISOString().split("T")[0],
                    schema: {
                        type: "object",
                        properties: {
                            analysis: {
                                type: "object",
                                properties: {
                                    gaps: { type: "array", items: { type: "string" } },
                                    nextSteps: { type: "array", items: { type: "string" } },
                                    shouldContinue: { type: "boolean" },
                                    nextSearchTopic: { type: "string" },
                                },
                                required: ["gaps", "nextSteps", "shouldContinue"],
                            },
                        },
                    },
                    prompt: (0, llmExtract_1.trimToTokenLimit)(`You are researching: ${currentTopic}
              You have ${timeRemainingMinutes} minutes remaining to complete the research but you don't need to use all of it.
              Current findings: ${findings.map((f) => `[From ${f.source}]: ${f.text}`).join("\n")}
              What has been learned? What gaps remain, if any? What specific aspects should be investigated next if any?
              If you need to search for more information inside the same topic pick a sub-topic by including a nextSearchTopic -which should be highly related to the original topic/users'query.
              Important: If less than 1 minute remains, set shouldContinue to false to allow time for final synthesis.
              If I have enough information, set shouldContinue to false.`, 120000).text,
                },
                markdown: "",
                costTrackingOptions: {
                    costTracking,
                    metadata: {
                        module: "deep-research",
                        method: "analyzeAndPlan",
                    },
                },
            });
            return extract.analysis;
        }
        catch (error) {
            this.logger.error("Analysis error", { error });
            return null;
        }
    }
    async generateFinalAnalysis(topic, findings, summaries, analysisPrompt, costTracking, formats, jsonOptions) {
        if (!formats) {
            formats = ["markdown"];
        }
        if (!jsonOptions) {
            jsonOptions = undefined;
        }
        const { extract } = await (0, llmExtract_1.generateCompletions)({
            logger: this.logger.child({
                method: "generateFinalAnalysis",
            }),
            mode: formats.includes("json") ? "object" : "no-object",
            options: {
                mode: "llm",
                ...(formats.includes("json") && {
                    ...jsonOptions,
                }),
                systemPrompt: formats.includes("json")
                    ? "You are an expert research analyst who creates comprehensive, structured analysis following the provided JSON schema exactly."
                    : "You are an expert research analyst who creates comprehensive, well-structured reports.  Don't begin the report by saying 'Here is the report', nor 'Below is the report', nor something similar. ALWAYS start with a great title that reflects the research topic and findings. Your reports are detailed, properly formatted in Markdown, and include clear sections with citations. Today's date is " +
                        new Date().toISOString().split("T")[0],
                prompt: (0, llmExtract_1.trimToTokenLimit)(analysisPrompt
                    ? `${analysisPrompt}\n\nResearch data:\n${findings.map((f) => `[From ${f.source}]: ${f.text}`).join("\n")}`
                    : formats.includes("json")
                        ? `Analyze the following research data on "${topic}" and structure the output according to the provided schema: Schema: ${JSON.stringify(jsonOptions?.schema)}\n\nFindings:\n\n${findings.map((f) => `[From ${f.source}]: ${f.text}`).join("\n")}`
                        : `Create a comprehensive research report on "${topic}" based on the collected findings and analysis.
  
                Research data:
                ${findings.map((f) => `[From ${f.source}]: ${f.text}`).join("\n")}
    
                Requirements:
                - Format the report in Markdown with proper headers and sections
                - Include specific citations to sources where appropriate
                - Provide detailed analysis in each section
                - Make it comprehensive and thorough (aim for 4+ pages worth of content)
                - Include all relevant findings and insights from the research
                - Cite sources
                - Cite sources throughout the report
                - Use bullet points and lists where appropriate for readability
                - Don't begin the report by saying "Here is the report", nor "Below is the report", nor something similar.
                - ALWAYS Start with a great title that reflects the research topic and findings - concise and to the point. That's the first thing you should output.
                
                Begin!`, 100000).text,
            },
            markdown: "",
            model: (0, generic_ai_1.getModel)("o3-mini"),
            costTrackingOptions: {
                costTracking,
                metadata: {
                    module: "deep-research",
                    method: "generateFinalAnalysis",
                },
            },
        });
        return extract;
    }
}
exports.ResearchLLMService = ResearchLLMService;
//# sourceMappingURL=research-manager.js.map