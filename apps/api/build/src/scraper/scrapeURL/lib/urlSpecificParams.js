"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlSpecificParams = void 0;
// const docsParam: UrlSpecificParams = {
//     scrapeOptions: { waitFor: 2000 },
//     internalOptions: {},
// }
exports.urlSpecificParams = {
    // "support.greenpay.me": docsParam,
    // "docs.pdw.co": docsParam,
    // "developers.notion.com": docsParam,
    // "docs2.hubitat.com": docsParam,
    // "rsseau.fr": docsParam,
    // "help.salesforce.com": docsParam,
    // "scrapethissite.com": {
    //     scrapeOptions: {},
    //     internalOptions: { forceEngine: "fetch" },
    // },
    // "eonhealth.com": {
    //     defaultScraper: "fire-engine",
    //     params: {
    //         fireEngineOptions: {
    //             mobileProxy: true,
    //             method: "get",
    //             engine: "request",
    //         },
    //     },
    // },
    // "notion.com": {
    //     scrapeOptions: { waitFor: 2000 },
    //     internalOptions: { forceEngine: "fire-engine;playwright" }
    // },
    // "developer.apple.com": {
    //     scrapeOptions: { waitFor: 2000 },
    //     internalOptions: { forceEngine: "fire-engine;playwright" }
    // },
    "digikey.com": {
        scrapeOptions: {},
        internalOptions: { forceEngine: "fire-engine;tlsclient" },
    },
    "lorealparis.hu": {
        scrapeOptions: {},
        internalOptions: { forceEngine: "fire-engine;tlsclient" },
    },
};
//# sourceMappingURL=urlSpecificParams.js.map