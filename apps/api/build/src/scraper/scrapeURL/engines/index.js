"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engineOptions = exports.featureFlagOptions = exports.featureFlags = exports.engines = void 0;
exports.buildFallbackList = buildFallbackList;
exports.scrapeURLWithEngine = scrapeURLWithEngine;
const docx_1 = require("./docx");
const fire_engine_1 = require("./fire-engine");
const pdf_1 = require("./pdf");
const fetch_1 = require("./fetch");
const playwright_1 = require("./playwright");
const index_1 = require("./index/index");
const services_1 = require("../../../services");
const useFireEngine = process.env.FIRE_ENGINE_BETA_URL !== "" &&
    process.env.FIRE_ENGINE_BETA_URL !== undefined;
const usePlaywright = process.env.PLAYWRIGHT_MICROSERVICE_URL !== "" &&
    process.env.PLAYWRIGHT_MICROSERVICE_URL !== undefined;
exports.engines = [
    ...(services_1.useIndex ? ["index", "index;documents"] : []),
    ...(useFireEngine
        ? [
            "fire-engine;chrome-cdp",
            "fire-engine;chrome-cdp;stealth",
            "fire-engine(retry);chrome-cdp",
            "fire-engine(retry);chrome-cdp;stealth",
            "fire-engine;playwright",
            "fire-engine;playwright;stealth",
            "fire-engine;tlsclient",
            "fire-engine;tlsclient;stealth",
        ]
        : []),
    ...(usePlaywright ? ["playwright"] : []),
    "fetch",
    "pdf",
    "docx",
];
exports.featureFlags = [
    "actions",
    "waitFor",
    "screenshot",
    "screenshot@fullScreen",
    "pdf",
    "docx",
    "atsv",
    "location",
    "mobile",
    "skipTlsVerification",
    "useFastMode",
    "stealthProxy",
    "disableAdblock",
];
exports.featureFlagOptions = {
    actions: { priority: 20 },
    waitFor: { priority: 1 },
    screenshot: { priority: 10 },
    "screenshot@fullScreen": { priority: 10 },
    pdf: { priority: 100 },
    docx: { priority: 100 },
    atsv: { priority: 90 }, // NOTE: should atsv force to tlsclient? adjust priority if not
    useFastMode: { priority: 90 },
    location: { priority: 10 },
    mobile: { priority: 10 },
    skipTlsVerification: { priority: 10 },
    stealthProxy: { priority: 20 },
    disableAdblock: { priority: 10 },
};
const engineHandlers = {
    index: index_1.scrapeURLWithIndex,
    "index;documents": index_1.scrapeURLWithIndex,
    "fire-engine;chrome-cdp": fire_engine_1.scrapeURLWithFireEngineChromeCDP,
    "fire-engine(retry);chrome-cdp": fire_engine_1.scrapeURLWithFireEngineChromeCDP,
    "fire-engine;chrome-cdp;stealth": fire_engine_1.scrapeURLWithFireEngineChromeCDP,
    "fire-engine(retry);chrome-cdp;stealth": fire_engine_1.scrapeURLWithFireEngineChromeCDP,
    "fire-engine;playwright": fire_engine_1.scrapeURLWithFireEnginePlaywright,
    "fire-engine;playwright;stealth": fire_engine_1.scrapeURLWithFireEnginePlaywright,
    "fire-engine;tlsclient": fire_engine_1.scrapeURLWithFireEngineTLSClient,
    "fire-engine;tlsclient;stealth": fire_engine_1.scrapeURLWithFireEngineTLSClient,
    playwright: playwright_1.scrapeURLWithPlaywright,
    fetch: fetch_1.scrapeURLWithFetch,
    pdf: pdf_1.scrapePDF,
    docx: docx_1.scrapeDOCX,
};
exports.engineOptions = {
    index: {
        features: {
            actions: false,
            waitFor: true,
            screenshot: true,
            "screenshot@fullScreen": true,
            pdf: false,
            docx: false,
            atsv: false,
            mobile: true,
            location: true,
            skipTlsVerification: true,
            useFastMode: true,
            stealthProxy: false,
            disableAdblock: true,
        },
        quality: 1000, // index should always be tried first
    },
    "fire-engine;chrome-cdp": {
        features: {
            actions: true,
            waitFor: true, // through actions transform
            screenshot: true, // through actions transform
            "screenshot@fullScreen": true, // through actions transform
            pdf: false,
            docx: false,
            atsv: false,
            location: true,
            mobile: true,
            skipTlsVerification: true,
            useFastMode: false,
            stealthProxy: false,
            disableAdblock: false,
        },
        quality: 50,
    },
    "fire-engine(retry);chrome-cdp": {
        features: {
            actions: true,
            waitFor: true, // through actions transform
            screenshot: true, // through actions transform
            "screenshot@fullScreen": true, // through actions transform
            pdf: false,
            docx: false,
            atsv: false,
            location: true,
            mobile: true,
            skipTlsVerification: true,
            useFastMode: false,
            stealthProxy: false,
            disableAdblock: false,
        },
        quality: 45,
    },
    "index;documents": {
        features: {
            actions: false,
            waitFor: true,
            screenshot: true,
            "screenshot@fullScreen": true,
            pdf: true,
            docx: true,
            atsv: false,
            location: true,
            mobile: true,
            skipTlsVerification: true,
            useFastMode: true,
            stealthProxy: false,
            disableAdblock: false,
        },
        quality: -1,
    },
    "fire-engine;chrome-cdp;stealth": {
        features: {
            actions: true,
            waitFor: true, // through actions transform
            screenshot: true, // through actions transform
            "screenshot@fullScreen": true, // through actions transform
            pdf: false,
            docx: false,
            atsv: false,
            location: true,
            mobile: true,
            skipTlsVerification: true,
            useFastMode: false,
            stealthProxy: true,
            disableAdblock: false,
        },
        quality: -2,
    },
    "fire-engine(retry);chrome-cdp;stealth": {
        features: {
            actions: true,
            waitFor: true, // through actions transform
            screenshot: true, // through actions transform
            "screenshot@fullScreen": true, // through actions transform
            pdf: false,
            docx: false,
            atsv: false,
            location: true,
            mobile: true,
            skipTlsVerification: true,
            useFastMode: false,
            stealthProxy: true,
            disableAdblock: false,
        },
        quality: -5,
    },
    "fire-engine;playwright": {
        features: {
            actions: false,
            waitFor: true,
            screenshot: true,
            "screenshot@fullScreen": true,
            pdf: false,
            docx: false,
            atsv: false,
            location: false,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: false,
            stealthProxy: false,
            disableAdblock: true,
        },
        quality: 40,
    },
    "fire-engine;playwright;stealth": {
        features: {
            actions: false,
            waitFor: true,
            screenshot: true,
            "screenshot@fullScreen": true,
            pdf: false,
            docx: false,
            atsv: false,
            location: false,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: false,
            stealthProxy: true,
            disableAdblock: true,
        },
        quality: -10,
    },
    playwright: {
        features: {
            actions: false,
            waitFor: true,
            screenshot: false,
            "screenshot@fullScreen": false,
            pdf: false,
            docx: false,
            atsv: false,
            location: false,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: false,
            stealthProxy: false,
            disableAdblock: false,
        },
        quality: 20,
    },
    "fire-engine;tlsclient": {
        features: {
            actions: false,
            waitFor: false,
            screenshot: false,
            "screenshot@fullScreen": false,
            pdf: false,
            docx: false,
            atsv: true,
            location: true,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: true,
            stealthProxy: false,
            disableAdblock: false,
        },
        quality: 10,
    },
    "fire-engine;tlsclient;stealth": {
        features: {
            actions: false,
            waitFor: false,
            screenshot: false,
            "screenshot@fullScreen": false,
            pdf: false,
            docx: false,
            atsv: true,
            location: true,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: true,
            stealthProxy: true,
            disableAdblock: false,
        },
        quality: -15,
    },
    fetch: {
        features: {
            actions: false,
            waitFor: false,
            screenshot: false,
            "screenshot@fullScreen": false,
            pdf: false,
            docx: false,
            atsv: false,
            location: false,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: true,
            stealthProxy: false,
            disableAdblock: false,
        },
        quality: 5,
    },
    pdf: {
        features: {
            actions: false,
            waitFor: false,
            screenshot: false,
            "screenshot@fullScreen": false,
            pdf: true,
            docx: false,
            atsv: false,
            location: false,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: true,
            stealthProxy: true, // kinda...
            disableAdblock: true,
        },
        quality: -20,
    },
    docx: {
        features: {
            actions: false,
            waitFor: false,
            screenshot: false,
            "screenshot@fullScreen": false,
            pdf: false,
            docx: true,
            atsv: false,
            location: false,
            mobile: false,
            skipTlsVerification: false,
            useFastMode: true,
            stealthProxy: true, // kinda...
            disableAdblock: true,
        },
        quality: -20,
    },
};
function buildFallbackList(meta) {
    const _engines = [
        ...exports.engines,
        // enable fire-engine in self-hosted testing environment when mocks are supplied
        ...((!useFireEngine && meta.mock !== null) ? ["fire-engine;chrome-cdp", "fire-engine(retry);chrome-cdp", "fire-engine;chrome-cdp;stealth", "fire-engine(retry);chrome-cdp;stealth", "fire-engine;playwright", "fire-engine;tlsclient", "fire-engine;playwright;stealth", "fire-engine;tlsclient;stealth"] : [])
    ];
    const shouldUseIndex = services_1.useIndex
        && process.env.FIRECRAWL_INDEX_WRITE_ONLY !== "true"
        && !meta.options.formats.includes("changeTracking")
        && meta.options.maxAge !== 0
        && (meta.options.headers === undefined
            || Object.keys(meta.options.headers).length === 0)
        && (meta.options.actions === undefined
            || meta.options.actions.length === 0)
        && meta.options.proxy !== "stealth";
    if (!shouldUseIndex) {
        const indexIndex = _engines.indexOf("index");
        if (indexIndex !== -1) {
            _engines.splice(indexIndex, 1);
        }
        const indexDocumentsIndex = _engines.indexOf("index;documents");
        if (indexDocumentsIndex !== -1) {
            _engines.splice(indexDocumentsIndex, 1);
        }
    }
    const prioritySum = [...meta.featureFlags].reduce((a, x) => a + exports.featureFlagOptions[x].priority, 0);
    const priorityThreshold = Math.floor(prioritySum / 2);
    let selectedEngines = [];
    const currentEngines = meta.internalOptions.forceEngine !== undefined
        ? (Array.isArray(meta.internalOptions.forceEngine) ? meta.internalOptions.forceEngine : [meta.internalOptions.forceEngine])
        : _engines;
    for (const engine of currentEngines) {
        const supportedFlags = new Set([
            ...Object.entries(exports.engineOptions[engine].features)
                .filter(([k, v]) => meta.featureFlags.has(k) && v === true)
                .map(([k, _]) => k),
        ]);
        const supportScore = [...supportedFlags].reduce((a, x) => a + exports.featureFlagOptions[x].priority, 0);
        const unsupportedFeatures = new Set([...meta.featureFlags]);
        for (const flag of meta.featureFlags) {
            if (supportedFlags.has(flag)) {
                unsupportedFeatures.delete(flag);
            }
        }
        if (supportScore >= priorityThreshold) {
            selectedEngines.push({ engine, supportScore, unsupportedFeatures });
        }
    }
    if (selectedEngines.some((x) => exports.engineOptions[x.engine].quality > 0)) {
        selectedEngines = selectedEngines.filter((x) => exports.engineOptions[x.engine].quality > 0);
    }
    if (meta.internalOptions.forceEngine === undefined) { // retain force engine order
        selectedEngines.sort((a, b) => b.supportScore - a.supportScore ||
            exports.engineOptions[b.engine].quality - exports.engineOptions[a.engine].quality);
    }
    meta.logger.info("Selected engines", {
        selectedEngines,
    });
    return selectedEngines;
}
async function scrapeURLWithEngine(meta, engine, timeToRun) {
    const fn = engineHandlers[engine];
    const logger = meta.logger.child({
        method: fn.name ?? "scrapeURLWithEngine",
        engine,
    });
    const _meta = {
        ...meta,
        logger,
    };
    return await fn(_meta, timeToRun);
}
//# sourceMappingURL=index.js.map