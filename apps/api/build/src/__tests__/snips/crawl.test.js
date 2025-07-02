"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("./lib");
const globals_1 = require("@jest/globals");
let identity;
beforeAll(async () => {
    identity = await (0, lib_1.idmux)({
        name: "crawl",
        concurrency: 100,
        credits: 1000000,
    });
}, 10000);
(0, globals_1.describe)("Crawl tests", () => {
    globals_1.it.concurrent("works", async () => {
        await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            limit: 10,
        }, identity);
    }, 10 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("filters URLs properly", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev/pricing",
            includePaths: ["^/pricing$"],
            limit: 10,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            (0, globals_1.expect)(res.completed).toBeGreaterThan(0);
            for (const page of res.data) {
                const url = new URL(page.metadata.url ?? page.metadata.sourceURL);
                (0, globals_1.expect)(url.pathname).toMatch(/^\/pricing$/);
            }
        }
    }, 10 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("filters URLs properly when using regexOnFullURL", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev/pricing",
            includePaths: ["^https://(www\\.)?firecrawl\\.dev/pricing$"],
            regexOnFullURL: true,
            limit: 10,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            (0, globals_1.expect)(res.completed).toBe(1);
            (0, globals_1.expect)(res.data[0].metadata.sourceURL).toBe("https://firecrawl.dev/pricing");
        }
    }, 10 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("delay parameter works", async () => {
        await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            limit: 3,
            delay: 5,
        }, identity);
    }, 3 * lib_1.scrapeTimeout + 3 * 5000);
    globals_1.it.concurrent("ongoing crawls endpoint works", async () => {
        const res = await (0, lib_1.asyncCrawl)({
            url: "https://firecrawl.dev",
            limit: 3,
        }, identity);
        const ongoing = await (0, lib_1.crawlOngoing)(identity);
        (0, globals_1.expect)(ongoing.crawls.find(x => x.id === res.id)).toBeDefined();
        await (0, lib_1.asyncCrawlWaitForFinish)(res.id, identity);
        const ongoing2 = await (0, lib_1.crawlOngoing)(identity);
        (0, globals_1.expect)(ongoing2.crawls.find(x => x.id === res.id)).toBeUndefined();
    }, 3 * lib_1.scrapeTimeout);
    // TEMP: Flaky
    // it.concurrent("discovers URLs properly when origin is not included", async () => {
    //     const res = await crawl({
    //         url: "https://firecrawl.dev",
    //         includePaths: ["^/blog"],
    //         ignoreSitemap: true,
    //         limit: 10,
    //     });
    //     expect(res.success).toBe(true);
    //     if (res.success) {
    //         expect(res.data.length).toBeGreaterThan(1);
    //         for (const page of res.data) {
    //             expect(page.metadata.url ?? page.metadata.sourceURL).toMatch(/^https:\/\/(www\.)?firecrawl\.dev\/blog/);
    //         }
    //     }
    // }, 300000);
    // TEMP: Flaky
    // it.concurrent("discovers URLs properly when maxDiscoveryDepth is provided", async () => {
    //     const res = await crawl({
    //         url: "https://firecrawl.dev",
    //         ignoreSitemap: true,
    //         maxDiscoveryDepth: 1,
    //         limit: 10,
    //     });
    //     expect(res.success).toBe(true);
    //     if (res.success) {
    //         expect(res.data.length).toBeGreaterThan(1);
    //         for (const page of res.data) {
    //             expect(page.metadata.url ?? page.metadata.sourceURL).not.toMatch(/^https:\/\/(www\.)?firecrawl\.dev\/blog\/.+$/);
    //         }
    //     }
    // }, 300000);
    globals_1.it.concurrent("crawlEntireDomain parameter works", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            crawlEntireDomain: true,
            limit: 5,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            (0, globals_1.expect)(res.completed).toBeGreaterThan(0);
        }
    }, 5 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("crawlEntireDomain takes precedence over allowBackwardLinks", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            allowBackwardLinks: false,
            crawlEntireDomain: true,
            limit: 5,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            (0, globals_1.expect)(res.completed).toBeGreaterThan(0);
        }
    }, 5 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("backward compatibility - allowBackwardLinks still works", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            allowBackwardLinks: true,
            limit: 5,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            (0, globals_1.expect)(res.completed).toBeGreaterThan(0);
        }
    }, 5 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("allowSubdomains parameter works", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            allowSubdomains: true,
            limit: 5,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            (0, globals_1.expect)(res.completed).toBeGreaterThan(0);
        }
    }, 5 * lib_1.scrapeTimeout);
    globals_1.it.concurrent("allowSubdomains blocks subdomains when false", async () => {
        const res = await (0, lib_1.crawl)({
            url: "https://firecrawl.dev",
            allowSubdomains: false,
            limit: 5,
        }, identity);
        (0, globals_1.expect)(res.success).toBe(true);
        if (res.success) {
            for (const page of res.data) {
                const url = new URL(page.metadata.url ?? page.metadata.sourceURL);
                (0, globals_1.expect)(url.hostname.endsWith("firecrawl.dev")).toBe(true);
            }
        }
    }, 5 * lib_1.scrapeTimeout);
});
//# sourceMappingURL=crawl.test.js.map