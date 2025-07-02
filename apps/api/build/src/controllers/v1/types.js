"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutSignal = exports.generateLLMsTextRequestSchema = exports.searchRequestSchema = exports.mapRequestSchema = exports.crawlRequestSchema = exports.batchScrapeRequestSchemaNoURLValidation = exports.batchScrapeRequestSchema = exports.webhookSchema = exports.scrapeRequestSchema = exports.extractRequestSchema = exports.extractV1Options = exports.scrapeOptions = exports.actionsSchema = exports.actionSchema = exports.extractOptionsWithAgent = exports.extractOptions = exports.agentOptionsExtract = exports.isAgentExtractModelValid = exports.agentExtractModelValue = exports.url = exports.IntegrationEnum = void 0;
exports.toLegacyCrawlerOptions = toLegacyCrawlerOptions;
exports.toNewCrawlerOptions = toNewCrawlerOptions;
exports.fromLegacyCrawlerOptions = fromLegacyCrawlerOptions;
exports.fromLegacyScrapeOptions = fromLegacyScrapeOptions;
exports.fromLegacyCombo = fromLegacyCombo;
exports.toLegacyDocument = toLegacyDocument;
const zod_1 = require("zod");
const validateUrl_1 = require("../../lib/validateUrl");
const validate_country_1 = require("../../lib/validate-country");
var IntegrationEnum;
(function (IntegrationEnum) {
    IntegrationEnum["DIFY"] = "dify";
    IntegrationEnum["ZAPIER"] = "zapier";
    IntegrationEnum["PIPEDREAM"] = "pipedream";
    IntegrationEnum["RAYCAST"] = "raycast";
    IntegrationEnum["LANGCHAIN"] = "langchain";
    IntegrationEnum["CREWAI"] = "crewai";
    IntegrationEnum["LLAMAINDEX"] = "llamaindex";
    IntegrationEnum["N8N"] = "n8n";
    IntegrationEnum["CAMELAI"] = "camelai";
    IntegrationEnum["MAKE"] = "make";
    IntegrationEnum["FLOWISE"] = "flowise";
    IntegrationEnum["METAGPT"] = "metagpt";
    IntegrationEnum["RELEVANCEAI"] = "relevanceai";
})(IntegrationEnum || (exports.IntegrationEnum = IntegrationEnum = {}));
exports.url = zod_1.z.preprocess((x) => {
    if (!(0, validateUrl_1.protocolIncluded)(x)) {
        x = `http://${x}`;
    }
    // transforming the query parameters is breaking certain sites, so we're not doing it - mogery
    // try {
    //   const urlObj = new URL(x as string);
    //   if (urlObj.search) {
    //     const searchParams = new URLSearchParams(urlObj.search.substring(1));
    //     return `${urlObj.origin}${urlObj.pathname}?${searchParams.toString()}`;
    //   }
    // } catch (e) {
    // }
    return x;
}, zod_1.z
    .string()
    .url()
    .regex(/^https?:\/\//, "URL uses unsupported protocol")
    .refine((x) => /(\.[a-zA-Z0-9-\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]{2,}|\.xn--[a-zA-Z0-9-]{1,})(:\d+)?([\/?#]|$)/i.test(x), "URL must have a valid top-level domain or be a valid path")
    .refine((x) => {
    try {
        (0, validateUrl_1.checkUrl)(x);
        return true;
    }
    catch (_) {
        return false;
    }
}, "Invalid URL")
// .refine((x) => !isUrlBlocked(x as string), BLOCKLISTED_URL_MESSAGE),
);
const strictMessage = "Unrecognized key in body -- please review the v1 API documentation for request body changes";
exports.agentExtractModelValue = 'fire-1';
const isAgentExtractModelValid = (x) => x?.toLowerCase() === exports.agentExtractModelValue;
exports.isAgentExtractModelValid = isAgentExtractModelValid;
exports.agentOptionsExtract = zod_1.z
    .object({
    model: zod_1.z.string().default(exports.agentExtractModelValue),
})
    .strict(strictMessage);
exports.extractOptions = zod_1.z
    .object({
    mode: zod_1.z.enum(["llm"]).default("llm"),
    schema: zod_1.z.any().optional(),
    systemPrompt: zod_1.z
        .string()
        .max(10000)
        .default(""),
    prompt: zod_1.z.string().max(10000).optional(),
    temperature: zod_1.z.number().optional(),
})
    .strict(strictMessage)
    .transform((data) => ({
    ...data,
    systemPrompt: "Based on the information on the page, extract all the information from the schema in JSON format. Try to extract all the fields even those that might not be marked as required."
}));
exports.extractOptionsWithAgent = zod_1.z
    .object({
    mode: zod_1.z.enum(["llm"]).default("llm"),
    schema: zod_1.z.any().optional(),
    systemPrompt: zod_1.z
        .string()
        .max(10000)
        .default(""),
    prompt: zod_1.z.string().max(10000).optional(),
    temperature: zod_1.z.number().optional(),
    agent: zod_1.z
        .object({
        model: zod_1.z.string().default(exports.agentExtractModelValue),
        prompt: zod_1.z.string().optional(),
    })
        .optional(),
})
    .strict(strictMessage)
    .transform((data) => ({
    ...data,
    systemPrompt: (0, exports.isAgentExtractModelValid)(data.agent?.model)
        ? `You are an expert web data extractor. Your task is to analyze the provided markdown content from a web page and generate a JSON object based *strictly* on the provided schema.

Key Instructions:
1.  **Schema Adherence:** Populate the JSON object according to the structure defined in the schema.
2.  **Content Grounding:** Extract information *only* if it is explicitly present in the provided markdown. Do NOT infer or fabricate information.
3.  **Missing Information:** If a piece of information required by the schema cannot be found in the markdown, use \`null\` for that field's value.
4.  **SmartScrape Recommendation:**
    *   Assess if the *full* required data seems unavailable in the current markdown likely because:
        - Content requires user interaction to reveal (e.g., clicking buttons, hovering, scrolling)
        - Content uses pagination (e.g., "Load More" buttons, numbered pagination, infinite scroll)
        - Content is dynamically loaded after user actions
    *   If the content requires user interaction or pagination to be fully accessible, set \`shouldUseSmartscrape\` to \`true\` in your response and provide a clear \`reasoning\` and \`prompt\` for the SmartScrape tool.
    *   If the content is simply JavaScript rendered but doesn't require interaction, set \`shouldUseSmartscrape\` to \`false\`.
5.  **Output Format:** Your final output MUST be a single, valid JSON object conforming precisely to the schema. Do not include any explanatory text outside the JSON structure.`
        : "Based on the information on the page, extract all the information from the schema in JSON format. Try to extract all the fields even those that might not be marked as required."
}));
const ACTIONS_MAX_WAIT_TIME = 60;
const MAX_ACTIONS = 50;
function calculateTotalWaitTime(actions = [], waitFor = 0) {
    const actionWaitTime = actions.reduce((acc, action) => {
        if (action.type === "wait") {
            if (action.milliseconds) {
                return acc + action.milliseconds;
            }
            // Consider selector actions as 1 second
            if (action.selector) {
                return acc + 1000;
            }
        }
        return acc;
    }, 0);
    return waitFor + actionWaitTime;
}
exports.actionSchema = zod_1.z
    .union([
    zod_1.z
        .object({
        type: zod_1.z.literal("wait"),
        milliseconds: zod_1.z.number().int().positive().finite().optional(),
        selector: zod_1.z.string().optional(),
    })
        .refine((data) => (data.milliseconds !== undefined || data.selector !== undefined) &&
        !(data.milliseconds !== undefined && data.selector !== undefined), {
        message: "Either 'milliseconds' or 'selector' must be provided, but not both.",
    }),
    zod_1.z.object({
        type: zod_1.z.literal("click"),
        selector: zod_1.z.string(),
        all: zod_1.z.boolean().default(false),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("screenshot"),
        fullPage: zod_1.z.boolean().default(false),
        quality: zod_1.z.number().min(1).max(100).optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("write"),
        text: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("press"),
        key: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("scroll"),
        direction: zod_1.z.enum(["up", "down"]).optional().default("down"),
        selector: zod_1.z.string().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("scrape"),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("executeJavascript"),
        script: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal("pdf"),
        landscape: zod_1.z.boolean().default(false),
        scale: zod_1.z.number().default(1),
        format: zod_1.z.enum(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger']).default("Letter"),
    }),
]);
exports.actionsSchema = zod_1.z
    .array(exports.actionSchema)
    .refine((actions) => actions.length <= MAX_ACTIONS, {
    message: `Number of actions cannot exceed ${MAX_ACTIONS}`,
})
    .refine((actions) => calculateTotalWaitTime(actions) <= ACTIONS_MAX_WAIT_TIME * 1000, {
    message: `Total wait time (waitFor + wait actions) cannot exceed ${ACTIONS_MAX_WAIT_TIME} seconds`,
});
const baseScrapeOptions = zod_1.z
    .object({
    formats: zod_1.z
        .enum([
        "markdown",
        "html",
        "rawHtml",
        "links",
        "screenshot",
        "screenshot@fullPage",
        "extract",
        "json",
        "changeTracking",
    ])
        .array()
        .optional()
        .default(["markdown"])
        .refine((x) => !(x.includes("screenshot") && x.includes("screenshot@fullPage")), "You may only specify either screenshot or screenshot@fullPage")
        .refine((x) => !x.includes("changeTracking") || x.includes("markdown"), "The changeTracking format requires the markdown format to be specified as well"),
    headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    includeTags: zod_1.z.string().array().optional(),
    excludeTags: zod_1.z.string().array().optional(),
    onlyMainContent: zod_1.z.boolean().default(true),
    timeout: zod_1.z.number().int().positive().finite().safe().optional(),
    waitFor: zod_1.z
        .number()
        .int()
        .nonnegative()
        .finite()
        .safe()
        .max(60000)
        .default(0),
    // Deprecate this to jsonOptions
    extract: exports.extractOptions.optional(),
    // New
    jsonOptions: exports.extractOptions.optional(),
    changeTrackingOptions: zod_1.z
        .object({
        prompt: zod_1.z.string().optional(),
        schema: zod_1.z.any().optional(),
        modes: zod_1.z.enum(["json", "git-diff"]).array().optional().default([]),
        tag: zod_1.z.string().or(zod_1.z.null()).default(null),
    })
        .optional(),
    mobile: zod_1.z.boolean().default(false),
    parsePDF: zod_1.z.boolean().default(true),
    actions: exports.actionsSchema.optional(),
    // New
    location: zod_1.z
        .object({
        country: zod_1.z
            .string()
            .optional()
            .refine((val) => !val ||
            Object.keys(validate_country_1.countries).includes(val.toUpperCase()) ||
            val === "US-generic", {
            message: "Invalid country code. Please use a valid ISO 3166-1 alpha-2 country code.",
        })
            .transform((val) => (val ? val.toUpperCase() : "US-generic")),
        languages: zod_1.z.string().array().optional(),
    })
        .optional(),
    // Deprecated
    geolocation: zod_1.z
        .object({
        country: zod_1.z
            .string()
            .optional()
            .refine((val) => !val || Object.keys(validate_country_1.countries).includes(val.toUpperCase()), {
            message: "Invalid country code. Please use a valid ISO 3166-1 alpha-2 country code.",
        })
            .transform((val) => (val ? val.toUpperCase() : "US-generic")),
        languages: zod_1.z.string().array().optional(),
    })
        .optional(),
    skipTlsVerification: zod_1.z.boolean().default(false),
    removeBase64Images: zod_1.z.boolean().default(true),
    fastMode: zod_1.z.boolean().default(false),
    useMock: zod_1.z.string().optional(),
    blockAds: zod_1.z.boolean().default(true),
    proxy: zod_1.z.enum(["basic", "stealth", "auto"]).optional(),
    maxAge: zod_1.z.number().int().gte(0).safe().default(0),
    storeInCache: zod_1.z.boolean().default(true),
    // @deprecated
    __experimental_cache: zod_1.z.boolean().default(false).optional(),
    __searchPreviewToken: zod_1.z.string().optional(),
})
    .strict(strictMessage);
const fire1Refine = (obj) => {
    if (obj.agent?.model?.toLowerCase() === "fire-1" && obj.jsonOptions?.agent?.model?.toLowerCase() === "fire-1") {
        return false;
    }
    return true;
};
const fire1RefineOpts = {
    message: "You may only specify the FIRE-1 model in agent or jsonOptions.agent, but not both.",
};
const extractRefine = (obj) => {
    const hasExtractFormat = obj.formats?.includes("extract");
    const hasExtractOptions = obj.extract !== undefined;
    const hasJsonFormat = obj.formats?.includes("json");
    const hasJsonOptions = obj.jsonOptions !== undefined;
    return (((hasExtractFormat && hasExtractOptions) ||
        (!hasExtractFormat && !hasExtractOptions)) &&
        ((hasJsonFormat && hasJsonOptions) || (!hasJsonFormat && !hasJsonOptions)));
};
const extractRefineOpts = {
    message: "When 'extract' or 'json' format is specified, corresponding options must be provided, and vice versa",
};
const extractTransform = (obj) => {
    // Handle timeout
    if ((obj.formats?.includes("extract") ||
        obj.extract ||
        obj.formats?.includes("json") ||
        obj.jsonOptions) &&
        obj.timeout === 30000) {
        obj = { ...obj, timeout: 60000 };
    }
    if (obj.formats?.includes("changeTracking") && (obj.waitFor === undefined || obj.waitFor < 5000)) {
        obj = { ...obj, waitFor: 5000 };
    }
    if (obj.formats?.includes("changeTracking") && obj.timeout === 30000) {
        obj = { ...obj, timeout: 60000 };
    }
    if (obj.agent) {
        obj = { ...obj, timeout: 300000 };
    }
    if ((obj.proxy === "stealth" || obj.proxy === "auto") && obj.timeout === 30000) {
        obj = { ...obj, timeout: 120000 };
    }
    if (obj.formats?.includes("json")) {
        obj.formats.push("extract");
    }
    // Convert JSON options to extract options if needed
    if (obj.jsonOptions && !obj.extract) {
        obj = {
            ...obj,
            extract: {
                prompt: obj.jsonOptions.prompt,
                systemPrompt: obj.jsonOptions.systemPrompt,
                schema: obj.jsonOptions.schema,
                agent: obj.jsonOptions.agent,
                mode: "llm",
            },
        };
    }
    return obj;
};
exports.scrapeOptions = baseScrapeOptions
    .extend({
    agent: zod_1.z
        .object({
        model: zod_1.z.string().default(exports.agentExtractModelValue),
        prompt: zod_1.z.string().optional(),
        sessionId: zod_1.z.string().optional(),
        waitBeforeClosingMs: zod_1.z.number().optional(),
    })
        .optional(),
    extract: exports.extractOptionsWithAgent.optional(),
    jsonOptions: exports.extractOptionsWithAgent.optional(),
})
    .strict(strictMessage)
    .refine((obj) => {
    if (!obj.actions)
        return true;
    return (calculateTotalWaitTime(obj.actions, obj.waitFor) <=
        ACTIONS_MAX_WAIT_TIME * 1000);
}, {
    message: `Total wait time (waitFor + wait actions) cannot exceed ${ACTIONS_MAX_WAIT_TIME} seconds`,
})
    .refine(extractRefine, extractRefineOpts)
    .refine(fire1Refine, fire1RefineOpts)
    .transform(extractTransform);
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default();
exports.extractV1Options = zod_1.z
    .object({
    urls: exports.url
        .array()
        .max(10, "Maximum of 10 URLs allowed per request while in beta.")
        .optional(),
    prompt: zod_1.z.string().max(10000).optional(),
    systemPrompt: zod_1.z.string().max(10000).optional(),
    schema: zod_1.z
        .any()
        .optional()
        .refine((val) => {
        if (!val)
            return true; // Allow undefined schema
        try {
            const validate = ajv.compile(val);
            return typeof validate === "function";
        }
        catch (e) {
            return false;
        }
    }, {
        message: "Invalid JSON schema.",
    }),
    limit: zod_1.z.number().int().positive().finite().safe().optional(),
    ignoreSitemap: zod_1.z.boolean().default(false),
    includeSubdomains: zod_1.z.boolean().default(true),
    allowExternalLinks: zod_1.z.boolean().default(false),
    enableWebSearch: zod_1.z.boolean().default(false),
    scrapeOptions: baseScrapeOptions.default({ onlyMainContent: false }).optional(),
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    urlTrace: zod_1.z.boolean().default(false),
    timeout: zod_1.z.number().int().positive().finite().safe().default(60000),
    __experimental_streamSteps: zod_1.z.boolean().default(false),
    __experimental_llmUsage: zod_1.z.boolean().default(false),
    __experimental_showSources: zod_1.z.boolean().default(false),
    showSources: zod_1.z.boolean().default(false),
    __experimental_cacheKey: zod_1.z.string().optional(),
    __experimental_cacheMode: zod_1.z
        .enum(["direct", "save", "load"])
        .default("direct")
        .optional(),
    agent: exports.agentOptionsExtract.optional(),
    __experimental_showCostTracking: zod_1.z.boolean().default(false),
    ignoreInvalidURLs: zod_1.z.boolean().default(false),
})
    .strict(strictMessage)
    .refine((obj) => obj.urls || obj.prompt, {
    message: "Either 'urls' or 'prompt' must be provided.",
})
    .transform((obj) => ({
    ...obj,
    allowExternalLinks: obj.allowExternalLinks || obj.enableWebSearch,
}))
    .refine((x) => (x.scrapeOptions ? extractRefine(x.scrapeOptions) : true), extractRefineOpts)
    .refine((x) => (x.scrapeOptions ? fire1Refine(x.scrapeOptions) : true), fire1RefineOpts)
    .transform((x) => ({
    ...x,
    scrapeOptions: x.scrapeOptions
        ? extractTransform(x.scrapeOptions)
        : x.scrapeOptions,
}));
exports.extractRequestSchema = exports.extractV1Options;
exports.scrapeRequestSchema = baseScrapeOptions
    .omit({ timeout: true })
    .extend({
    url: exports.url,
    agent: zod_1.z
        .object({
        model: zod_1.z.string().default(exports.agentExtractModelValue),
        prompt: zod_1.z.string().optional(),
        sessionId: zod_1.z.string().optional(),
        waitBeforeClosingMs: zod_1.z.number().optional(),
    })
        .optional(),
    extract: exports.extractOptionsWithAgent.optional(),
    jsonOptions: exports.extractOptionsWithAgent.optional(),
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    timeout: zod_1.z.number().int().positive().finite().safe().default(30000),
    zeroDataRetention: zod_1.z.boolean().optional(),
})
    .strict(strictMessage)
    .refine(extractRefine, extractRefineOpts)
    .refine(fire1Refine, fire1RefineOpts)
    .transform(extractTransform);
exports.webhookSchema = zod_1.z.preprocess((x) => {
    if (typeof x === "string") {
        return { url: x };
    }
    else {
        return x;
    }
}, zod_1.z
    .object({
    url: zod_1.z.string().url(),
    headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
    events: zod_1.z
        .array(zod_1.z.enum(["completed", "failed", "page", "started"]))
        .default(["completed", "failed", "page", "started"]),
})
    .strict(strictMessage));
exports.batchScrapeRequestSchema = baseScrapeOptions
    .extend({
    urls: exports.url.array(),
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    webhook: exports.webhookSchema.optional(),
    appendToId: zod_1.z.string().uuid().optional(),
    ignoreInvalidURLs: zod_1.z.boolean().default(false),
    maxConcurrency: zod_1.z.number().positive().int().optional(),
    zeroDataRetention: zod_1.z.boolean().optional(),
})
    .strict(strictMessage)
    .refine(extractRefine, extractRefineOpts)
    .refine(fire1Refine, fire1RefineOpts)
    .transform(extractTransform);
exports.batchScrapeRequestSchemaNoURLValidation = baseScrapeOptions
    .extend({
    urls: zod_1.z.string().array(),
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    webhook: exports.webhookSchema.optional(),
    appendToId: zod_1.z.string().uuid().optional(),
    ignoreInvalidURLs: zod_1.z.boolean().default(false),
    maxConcurrency: zod_1.z.number().positive().int().optional(),
    zeroDataRetention: zod_1.z.boolean().optional(),
})
    .strict(strictMessage)
    .refine(extractRefine, extractRefineOpts)
    .refine(fire1Refine, fire1RefineOpts)
    .transform(extractTransform);
const crawlerOptions = zod_1.z
    .object({
    includePaths: zod_1.z.string().array().default([]),
    excludePaths: zod_1.z.string().array().default([]),
    maxDepth: zod_1.z.number().default(10), // default?
    maxDiscoveryDepth: zod_1.z.number().optional(),
    limit: zod_1.z.number().default(10000), // default?
    allowBackwardLinks: zod_1.z.boolean().default(false), // DEPRECATED: use crawlEntireDomain
    crawlEntireDomain: zod_1.z.boolean().optional(),
    allowExternalLinks: zod_1.z.boolean().default(false),
    allowSubdomains: zod_1.z.boolean().default(false),
    ignoreRobotsTxt: zod_1.z.boolean().default(false),
    ignoreSitemap: zod_1.z.boolean().default(false),
    deduplicateSimilarURLs: zod_1.z.boolean().default(true),
    ignoreQueryParameters: zod_1.z.boolean().default(false),
    regexOnFullURL: zod_1.z.boolean().default(false),
    delay: zod_1.z.number().positive().optional(),
})
    .strict(strictMessage);
exports.crawlRequestSchema = crawlerOptions
    .extend({
    url: exports.url,
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    scrapeOptions: baseScrapeOptions.default({}),
    webhook: exports.webhookSchema.optional(),
    limit: zod_1.z.number().default(10000),
    maxConcurrency: zod_1.z.number().positive().int().optional(),
    zeroDataRetention: zod_1.z.boolean().optional(),
})
    .strict(strictMessage)
    .refine((x) => extractRefine(x.scrapeOptions), extractRefineOpts)
    .refine((x) => fire1Refine(x.scrapeOptions), fire1RefineOpts)
    .transform((x) => {
    if (x.crawlEntireDomain !== undefined) {
        x.allowBackwardLinks = x.crawlEntireDomain;
    }
    return {
        ...x,
        scrapeOptions: extractTransform(x.scrapeOptions),
    };
});
exports.mapRequestSchema = crawlerOptions
    .extend({
    url: exports.url,
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    includeSubdomains: zod_1.z.boolean().default(true),
    search: zod_1.z.string().optional(),
    ignoreSitemap: zod_1.z.boolean().default(false),
    sitemapOnly: zod_1.z.boolean().default(false),
    limit: zod_1.z.number().min(1).max(30000).default(5000),
    timeout: zod_1.z.number().positive().finite().optional(),
    useMock: zod_1.z.string().optional(),
    filterByPath: zod_1.z.boolean().default(true),
    useIndex: zod_1.z.boolean().default(true),
})
    .strict(strictMessage);
function toLegacyCrawlerOptions(x) {
    return {
        includes: x.includePaths,
        excludes: x.excludePaths,
        maxCrawledLinks: x.limit,
        maxDepth: x.maxDepth,
        limit: x.limit,
        generateImgAltText: false,
        allowBackwardCrawling: x.crawlEntireDomain ?? x.allowBackwardLinks,
        allowExternalContentLinks: x.allowExternalLinks,
        allowSubdomains: x.allowSubdomains,
        ignoreRobotsTxt: x.ignoreRobotsTxt,
        ignoreSitemap: x.ignoreSitemap,
        deduplicateSimilarURLs: x.deduplicateSimilarURLs,
        ignoreQueryParameters: x.ignoreQueryParameters,
        regexOnFullURL: x.regexOnFullURL,
        maxDiscoveryDepth: x.maxDiscoveryDepth,
        currentDiscoveryDepth: 0,
        delay: x.delay,
    };
}
function toNewCrawlerOptions(x) {
    return {
        includePaths: x.includes,
        excludePaths: x.excludes,
        limit: x.limit,
        maxDepth: x.maxDepth,
        allowBackwardLinks: x.allowBackwardCrawling,
        crawlEntireDomain: x.allowBackwardCrawling,
        allowExternalLinks: x.allowExternalContentLinks,
        allowSubdomains: x.allowSubdomains,
        ignoreRobotsTxt: x.ignoreRobotsTxt,
        ignoreSitemap: x.ignoreSitemap,
        deduplicateSimilarURLs: x.deduplicateSimilarURLs,
        ignoreQueryParameters: x.ignoreQueryParameters,
        regexOnFullURL: x.regexOnFullURL,
        maxDiscoveryDepth: x.maxDiscoveryDepth,
        delay: x.delay,
    };
}
function fromLegacyCrawlerOptions(x, teamId) {
    return {
        crawlOptions: crawlerOptions.parse({
            includePaths: x.includes,
            excludePaths: x.excludes,
            limit: x.maxCrawledLinks ?? x.limit,
            maxDepth: x.maxDepth,
            allowBackwardLinks: x.allowBackwardCrawling,
            crawlEntireDomain: x.allowBackwardCrawling,
            allowExternalLinks: x.allowExternalContentLinks,
            allowSubdomains: x.allowSubdomains,
            ignoreRobotsTxt: x.ignoreRobotsTxt,
            ignoreSitemap: x.ignoreSitemap,
            deduplicateSimilarURLs: x.deduplicateSimilarURLs,
            ignoreQueryParameters: x.ignoreQueryParameters,
            regexOnFullURL: x.regexOnFullURL,
            maxDiscoveryDepth: x.maxDiscoveryDepth,
            delay: x.delay,
        }),
        internalOptions: {
            v0CrawlOnlyUrls: x.returnOnlyUrls,
            teamId,
        },
    };
}
function fromLegacyScrapeOptions(pageOptions, extractorOptions, timeout, teamId) {
    return {
        scrapeOptions: exports.scrapeOptions.parse({
            formats: [
                (pageOptions.includeMarkdown ?? true) ? "markdown" : null,
                (pageOptions.includeHtml ?? false) ? "html" : null,
                (pageOptions.includeRawHtml ?? false) ? "rawHtml" : null,
                (pageOptions.screenshot ?? false) ? "screenshot" : null,
                (pageOptions.fullPageScreenshot ?? false)
                    ? "screenshot@fullPage"
                    : null,
                extractorOptions !== undefined &&
                    extractorOptions.mode.includes("llm-extraction")
                    ? "extract"
                    : null,
                "links",
            ].filter((x) => x !== null),
            waitFor: pageOptions.waitFor,
            headers: pageOptions.headers,
            includeTags: typeof pageOptions.onlyIncludeTags === "string"
                ? [pageOptions.onlyIncludeTags]
                : pageOptions.onlyIncludeTags,
            excludeTags: typeof pageOptions.removeTags === "string"
                ? [pageOptions.removeTags]
                : pageOptions.removeTags,
            onlyMainContent: pageOptions.onlyMainContent ?? false,
            timeout: timeout,
            parsePDF: pageOptions.parsePDF,
            actions: pageOptions.actions,
            location: pageOptions.geolocation,
            skipTlsVerification: pageOptions.skipTlsVerification,
            removeBase64Images: pageOptions.removeBase64Images,
            extract: extractorOptions !== undefined &&
                extractorOptions.mode.includes("llm-extraction")
                ? {
                    systemPrompt: extractorOptions.extractionPrompt,
                    prompt: extractorOptions.userPrompt,
                    schema: extractorOptions.extractionSchema,
                }
                : undefined,
            mobile: pageOptions.mobile,
            fastMode: pageOptions.useFastMode,
        }),
        internalOptions: {
            atsv: pageOptions.atsv,
            v0DisableJsDom: pageOptions.disableJsDom,
            teamId,
        },
        // TODO: fallback, fetchPageContent, replaceAllPathsWithAbsolutePaths, includeLinks
    };
}
function fromLegacyCombo(pageOptions, extractorOptions, timeout, crawlerOptions, teamId) {
    const { scrapeOptions, internalOptions: i1 } = fromLegacyScrapeOptions(pageOptions, extractorOptions, timeout, teamId);
    const { internalOptions: i2 } = fromLegacyCrawlerOptions(crawlerOptions, teamId);
    return { scrapeOptions, internalOptions: Object.assign(i1, i2) };
}
function toLegacyDocument(document, internalOptions) {
    if (internalOptions.v0CrawlOnlyUrls) {
        return { url: document.metadata.sourceURL };
    }
    return {
        content: document.markdown,
        markdown: document.markdown,
        html: document.html,
        rawHtml: document.rawHtml,
        linksOnPage: document.links,
        llm_extraction: document.extract,
        metadata: {
            ...document.metadata,
            error: undefined,
            statusCode: undefined,
            pageError: document.metadata.error,
            pageStatusCode: document.metadata.statusCode,
            screenshot: document.screenshot,
        },
        actions: document.actions,
        warning: document.warning,
    };
}
exports.searchRequestSchema = zod_1.z
    .object({
    query: zod_1.z.string(),
    limit: zod_1.z
        .number()
        .int()
        .positive()
        .finite()
        .safe()
        .max(100)
        .optional()
        .default(5),
    tbs: zod_1.z.string().optional(),
    filter: zod_1.z.string().optional(),
    lang: zod_1.z.string().optional().default("en"),
    country: zod_1.z.string().optional().default("us"),
    location: zod_1.z.string().optional(),
    origin: zod_1.z.string().optional().default("api"),
    integration: zod_1.z.nativeEnum(IntegrationEnum).optional().transform(val => val || null),
    timeout: zod_1.z.number().int().positive().finite().safe().default(60000),
    ignoreInvalidURLs: zod_1.z.boolean().optional().default(false),
    __searchPreviewToken: zod_1.z.string().optional(),
    scrapeOptions: baseScrapeOptions
        .extend({
        formats: zod_1.z
            .array(zod_1.z.enum([
            "markdown",
            "html",
            "rawHtml",
            "links",
            "screenshot",
            "screenshot@fullPage",
            "extract",
            "json",
        ]))
            .default([]),
    })
        .default({}),
})
    .strict("Unrecognized key in body -- please review the v1 API documentation for request body changes")
    .refine((x) => extractRefine(x.scrapeOptions), extractRefineOpts)
    .refine((x) => fire1Refine(x.scrapeOptions), fire1RefineOpts)
    .transform((x) => ({
    ...x,
    scrapeOptions: extractTransform(x.scrapeOptions),
}));
exports.generateLLMsTextRequestSchema = zod_1.z.object({
    url: exports.url.describe("The URL to generate text from"),
    maxUrls: zod_1.z
        .number()
        .min(1)
        .max(5000)
        .default(10)
        .describe("Maximum number of URLs to process"),
    showFullText: zod_1.z
        .boolean()
        .default(false)
        .describe("Whether to show the full LLMs-full.txt in the response"),
    cache: zod_1.z
        .boolean()
        .default(true)
        .describe("Whether to use cached content if available"),
    __experimental_stream: zod_1.z.boolean().optional(),
});
class TimeoutSignal extends Error {
    constructor() {
        super("Operation timed out");
    }
}
exports.TimeoutSignal = TimeoutSignal;
//# sourceMappingURL=types.js.map