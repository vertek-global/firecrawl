"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("./lib");
const crypto_1 = __importDefault(require("crypto"));
let identity;
beforeAll(async () => {
    identity = await (0, lib_1.idmux)({
        name: "scrape",
        concurrency: 100,
        credits: 1000000,
    });
    if (!process.env.TEST_SUITE_SELF_HOSTED) {
        // Needed for change tracking tests to work
        await (0, lib_1.scrape)({
            url: "https://example.com",
            formats: ["markdown", "changeTracking"],
            timeout: lib_1.scrapeTimeout,
        }, identity);
    }
}, 10000 + lib_1.scrapeTimeout);
describe("Scrape tests", () => {
    it.concurrent("mocking works properly", async () => {
        // depends on falsified mock mocking-works-properly
        // this test will fail if mock is bypassed with real data -- firecrawl.dev will never have
        // that as its actual markdown output
        const response = await (0, lib_1.scrape)({
            url: "http://firecrawl.dev",
            useMock: "mocking-works-properly",
            timeout: lib_1.scrapeTimeout,
        }, identity);
        expect(response.markdown).toBe("this is fake data coming from the mocking system!");
    }, lib_1.scrapeTimeout);
    it.concurrent("works", async () => {
        const response = await (0, lib_1.scrape)({
            url: "http://firecrawl.dev",
            timeout: lib_1.scrapeTimeout,
        }, identity);
        expect(response.markdown).toContain("Firecrawl");
    }, lib_1.scrapeTimeout);
    it.concurrent("works with Punycode domains", async () => {
        await (0, lib_1.scrape)({
            url: "http://xn--1lqv92a901a.xn--ses554g/",
            timeout: lib_1.scrapeTimeout,
        }, identity);
    }, lib_1.scrapeTimeout);
    it.concurrent("handles non-UTF-8 encodings", async () => {
        const response = await (0, lib_1.scrape)({
            url: "https://www.rtpro.yamaha.co.jp/RT/docs/misc/kanji-sjis.html",
            timeout: lib_1.scrapeTimeout,
        }, identity);
        expect(response.markdown).toContain("ぐ け げ こ ご さ ざ し じ す ず せ ぜ そ ぞ た");
    }, lib_1.scrapeTimeout);
    if (process.env.TEST_SUITE_SELF_HOSTED && process.env.PROXY_SERVER) {
        it.concurrent("self-hosted proxy works", async () => {
            const response = await (0, lib_1.scrape)({
                url: "https://icanhazip.com",
                timeout: lib_1.scrapeTimeout,
            }, identity);
            expect(response.markdown?.trim()).toContain(process.env.PROXY_SERVER.split("://").slice(-1)[0].split(":")[0]);
        }, lib_1.scrapeTimeout);
        it.concurrent("self-hosted proxy works on playwright", async () => {
            const response = await (0, lib_1.scrape)({
                url: "https://icanhazip.com",
                waitFor: 100,
                timeout: lib_1.scrapeTimeout,
            }, identity);
            expect(response.markdown?.trim()).toContain(process.env.PROXY_SERVER.split("://").slice(-1)[0].split(":")[0]);
        }, lib_1.scrapeTimeout);
    }
    if (!process.env.TEST_SUITE_SELF_HOSTED || process.env.PLAYWRIGHT_MICROSERVICE_URL) {
        it.concurrent("waitFor works", async () => {
            const response = await (0, lib_1.scrape)({
                url: "http://firecrawl.dev",
                waitFor: 2000,
                timeout: lib_1.scrapeTimeout,
            }, identity);
            expect(response.markdown).toContain("Firecrawl");
        }, lib_1.scrapeTimeout);
    }
    describe("JSON scrape support", () => {
        it.concurrent("returns parseable JSON", async () => {
            const response = await (0, lib_1.scrape)({
                url: "https://jsonplaceholder.typicode.com/todos/1",
                formats: ["rawHtml"],
                timeout: lib_1.scrapeTimeout,
            }, identity);
            const obj = JSON.parse(response.rawHtml);
            expect(obj.id).toBe(1);
        }, lib_1.scrapeTimeout);
    });
    if (!process.env.TEST_SUITE_SELF_HOSTED) {
        it.concurrent("scrape status works", async () => {
            const response = await (0, lib_1.scrape)({
                url: "http://firecrawl.dev",
                timeout: lib_1.scrapeTimeout,
            }, identity);
            expect(response.markdown).toContain("Firecrawl");
            // Give time to propagate to read replica
            await new Promise(resolve => setTimeout(resolve, 1000));
            const status = await (0, lib_1.scrapeStatus)(response.metadata.scrapeId, identity);
            expect(JSON.stringify(status)).toBe(JSON.stringify(response));
        }, lib_1.scrapeTimeout);
        describe("Ad blocking (f-e dependant)", () => {
            it.concurrent("blocking ads works", async () => {
                await (0, lib_1.scrape)({
                    url: "https://firecrawl.dev",
                    blockAds: true,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
            }, lib_1.scrapeTimeout);
            it.concurrent("doesn't block ads if explicitly disabled", async () => {
                await (0, lib_1.scrape)({
                    url: "https://firecrawl.dev",
                    blockAds: false,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
            }, lib_1.scrapeTimeout);
        });
        describe("Index", () => {
            it.concurrent("caches properly", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                const response1 = await (0, lib_1.scrape)({
                    url,
                    maxAge: lib_1.scrapeTimeout * 3,
                    storeInCache: false,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response1.metadata.cacheState).toBe("miss");
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    maxAge: lib_1.scrapeTimeout * 3,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response2.metadata.cacheState).toBe("miss");
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response3 = await (0, lib_1.scrape)({
                    url,
                    maxAge: lib_1.scrapeTimeout * 3,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response3.metadata.cacheState).toBe("hit");
                expect(response3.metadata.cachedAt).toBeDefined();
                const response4 = await (0, lib_1.scrape)({
                    url,
                    maxAge: 1,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response4.metadata.cacheState).toBe("miss");
            }, lib_1.scrapeTimeout * 4 + 2 * lib_1.indexCooldown);
            it.concurrent("caches PDFs properly", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://www.orimi.com/pdf-test.pdf?testId=" + id;
                const response1 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response1.metadata.cacheState).toBe("miss");
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response2.metadata.cacheState).toBe("hit");
            }, lib_1.scrapeTimeout * 2 + 2 * lib_1.indexCooldown);
            it.concurrent("respects screenshot", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                const response1 = await (0, lib_1.scrape)({
                    url,
                    formats: ["screenshot"],
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response1.screenshot).toBeDefined();
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    formats: ["screenshot"],
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response2.screenshot).toBe(response1.screenshot);
                const response3 = await (0, lib_1.scrape)({
                    url,
                    formats: ["screenshot@fullPage"],
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3,
                }, identity);
                expect(response3.screenshot).not.toBe(response1.screenshot);
                expect(response3.metadata.cacheState).toBe("miss");
            }, lib_1.scrapeTimeout * 3 + 2 * lib_1.indexCooldown);
            it.concurrent("respects screenshot@fullPage", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                const response1 = await (0, lib_1.scrape)({
                    url,
                    formats: ["screenshot@fullPage"],
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response1.screenshot).toBeDefined();
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    formats: ["screenshot@fullPage"],
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response2.screenshot).toBe(response1.screenshot);
                const response3 = await (0, lib_1.scrape)({
                    url,
                    formats: ["screenshot"],
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3,
                }, identity);
                expect(response3.screenshot).not.toBe(response1.screenshot);
                expect(response3.metadata.cacheState).toBe("miss");
            }, lib_1.scrapeTimeout * 3 + 1 * lib_1.indexCooldown);
            it.concurrent("respects changeTracking", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                await (0, lib_1.scrape)({
                    url,
                    formats: ["markdown", "changeTracking"],
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                const response1 = await (0, lib_1.scrape)({
                    url,
                    formats: ["markdown", "changeTracking"],
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response1.metadata.cacheState).not.toBeDefined();
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    formats: ["markdown"],
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3 + lib_1.indexCooldown,
                }, identity);
                expect(response2.metadata.cacheState).toBe("hit");
            }, lib_1.scrapeTimeout * 3 + 2 * lib_1.indexCooldown);
            it.concurrent("respects headers", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                await (0, lib_1.scrape)({
                    url,
                    headers: {
                        "X-Test": "test",
                    },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2 + lib_1.indexCooldown,
                }, identity);
                expect(response.metadata.cacheState).toBe("miss");
            }, lib_1.scrapeTimeout * 2 + 1 * lib_1.indexCooldown);
            it.concurrent("respects mobile", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response1 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                    mobile: true,
                }, identity);
                expect(response1.metadata.cacheState).toBe("miss");
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3,
                    mobile: true,
                }, identity);
                expect(response2.metadata.cacheState).toBe("hit");
            }, lib_1.scrapeTimeout * 3 + 2 * lib_1.indexCooldown);
            it.concurrent("respects actions", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                const response1 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout,
                    actions: [{
                            "type": "wait",
                            "milliseconds": 1000,
                        }]
                }, identity);
                expect(response1.metadata.cacheState).not.toBeDefined();
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response2.metadata.cacheState).toBe("miss");
            }, lib_1.scrapeTimeout * 2 + 1 * lib_1.indexCooldown);
            it.concurrent("respects location", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response1 = await (0, lib_1.scrape)({
                    url,
                    location: { country: "DE" },
                    maxAge: lib_1.scrapeTimeout * 2,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response1.metadata.cacheState).toBe("miss");
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    location: { country: "DE" },
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3,
                }, identity);
                expect(response2.metadata.cacheState).toBe("hit");
            }, lib_1.scrapeTimeout * 3 + 2 * lib_1.indexCooldown);
            it.concurrent("respects blockAds", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                await (0, lib_1.scrape)({
                    url,
                    blockAds: true,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response0 = await (0, lib_1.scrape)({
                    url,
                    blockAds: true,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2 + lib_1.indexCooldown,
                }, identity);
                expect(response0.metadata.cacheState).toBe("hit");
                const response1 = await (0, lib_1.scrape)({
                    url,
                    blockAds: false,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3 + lib_1.indexCooldown,
                }, identity);
                expect(response1.metadata.cacheState).toBe("miss");
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    blockAds: false,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 4 + 2 * lib_1.indexCooldown,
                }, identity);
                expect(response2.metadata.cacheState).toBe("hit");
            }, lib_1.scrapeTimeout * 4 + 2 * lib_1.indexCooldown);
            it.concurrent("respects proxy: stealth", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                const response1 = await (0, lib_1.scrape)({
                    url,
                    proxy: "stealth",
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout,
                }, identity);
                expect(response1.metadata.proxyUsed).toBe("stealth");
                expect(response1.metadata.cacheState).not.toBeDefined();
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response2 = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2 + lib_1.indexCooldown,
                }, identity);
                expect(response2.metadata.cacheState).toBe("hit");
                const response3 = await (0, lib_1.scrape)({
                    url,
                    proxy: "stealth",
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 3 + lib_1.indexCooldown,
                }, identity);
                expect(response3.metadata.cacheState).not.toBeDefined();
            }, lib_1.scrapeTimeout * 3 + lib_1.indexCooldown);
            it.concurrent("works properly on pages returning 200", async () => {
                const id = crypto_1.default.randomUUID();
                const url = "https://firecrawl.dev/?testId=" + id;
                await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                await new Promise(resolve => setTimeout(resolve, lib_1.indexCooldown));
                const response = await (0, lib_1.scrape)({
                    url,
                    timeout: lib_1.scrapeTimeout,
                    maxAge: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(response.metadata.cacheState).toBe("hit");
            }, lib_1.scrapeTimeout * 2 + 1 * lib_1.indexCooldown);
        });
        describe("Change Tracking format", () => {
            it.concurrent("works", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://example.com",
                    formats: ["markdown", "changeTracking"],
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.changeTracking).toBeDefined();
                expect(response.changeTracking?.previousScrapeAt).not.toBeNull();
            }, lib_1.scrapeTimeout);
            it.concurrent("includes git diff when requested", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://example.com",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: {
                        modes: ["git-diff"]
                    },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.changeTracking).toBeDefined();
                expect(response.changeTracking?.previousScrapeAt).not.toBeNull();
                if (response.changeTracking?.changeStatus === "changed") {
                    expect(response.changeTracking?.diff).toBeDefined();
                    expect(response.changeTracking?.diff?.text).toBeDefined();
                    expect(response.changeTracking?.diff?.json).toBeDefined();
                    expect(response.changeTracking?.diff?.json.files).toBeInstanceOf(Array);
                }
            }, lib_1.scrapeTimeout);
            it.concurrent("includes structured output when requested", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://example.com",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: {
                        modes: ["json"],
                        prompt: "Summarize the changes between the previous and current content",
                    },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.changeTracking).toBeDefined();
                expect(response.changeTracking?.previousScrapeAt).not.toBeNull();
                if (response.changeTracking?.changeStatus === "changed") {
                    expect(response.changeTracking?.json).toBeDefined();
                }
            }, lib_1.scrapeTimeout);
            it.concurrent("supports schema-based extraction for change tracking", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://example.com",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: {
                        modes: ["json"],
                        schema: {
                            type: "object",
                            properties: {
                                pricing: {
                                    type: "object",
                                    properties: {
                                        amount: { type: "number" },
                                        currency: { type: "string" }
                                    }
                                },
                                features: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            }
                        }
                    },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.changeTracking).toBeDefined();
                expect(response.changeTracking?.previousScrapeAt).not.toBeNull();
                if (response.changeTracking?.changeStatus === "changed") {
                    expect(response.changeTracking?.json).toBeDefined();
                    if (response.changeTracking?.json.pricing) {
                        expect(response.changeTracking?.json.pricing).toHaveProperty("old");
                        expect(response.changeTracking?.json.pricing).toHaveProperty("new");
                    }
                    if (response.changeTracking?.json.features) {
                        expect(response.changeTracking?.json.features).toHaveProperty("old");
                        expect(response.changeTracking?.json.features).toHaveProperty("new");
                    }
                }
            }, lib_1.scrapeTimeout);
            it.concurrent("supports both git-diff and structured modes together", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://example.com",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: {
                        modes: ["git-diff", "json"],
                        schema: {
                            type: "object",
                            properties: {
                                summary: { type: "string" },
                                changes: { type: "array", items: { type: "string" } }
                            }
                        }
                    },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.changeTracking).toBeDefined();
                expect(response.changeTracking?.previousScrapeAt).not.toBeNull();
                if (response.changeTracking?.changeStatus === "changed") {
                    expect(response.changeTracking?.diff).toBeDefined();
                    expect(response.changeTracking?.diff?.text).toBeDefined();
                    expect(response.changeTracking?.diff?.json).toBeDefined();
                    expect(response.changeTracking?.json).toBeDefined();
                    expect(response.changeTracking?.json).toHaveProperty("summary");
                    expect(response.changeTracking?.json).toHaveProperty("changes");
                }
            }, lib_1.scrapeTimeout);
            it.concurrent("supports tags properly", async () => {
                const uuid1 = crypto_1.default.randomUUID();
                const uuid2 = crypto_1.default.randomUUID();
                const response1 = await (0, lib_1.scrape)({
                    url: "https://firecrawl.dev/",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: { tag: uuid1 },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                const response2 = await (0, lib_1.scrape)({
                    url: "https://firecrawl.dev/",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: { tag: uuid2 },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response1.changeTracking?.previousScrapeAt).toBeNull();
                expect(response1.changeTracking?.changeStatus).toBe("new");
                expect(response2.changeTracking?.previousScrapeAt).toBeNull();
                expect(response2.changeTracking?.changeStatus).toBe("new");
                const response3 = await (0, lib_1.scrape)({
                    url: "https://firecrawl.dev/",
                    formats: ["markdown", "changeTracking"],
                    changeTrackingOptions: { tag: uuid1 },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response3.changeTracking?.previousScrapeAt).not.toBeNull();
                expect(response3.changeTracking?.changeStatus).not.toBe("new");
            }, lib_1.scrapeTimeout * 3);
        });
        describe("Location API (f-e dependant)", () => {
            it.concurrent("works without specifying an explicit location", async () => {
                await (0, lib_1.scrape)({
                    url: "https://iplocation.com",
                    timeout: lib_1.scrapeTimeout,
                }, identity);
            }, lib_1.scrapeTimeout);
            it.concurrent("works with country US", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://iplocation.com",
                    location: { country: "US" },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.markdown).toContain("| Country | United States |");
            }, lib_1.scrapeTimeout);
        });
        describe("Screenshot (f-e dependant)", () => {
            it.concurrent("screenshot format works", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    formats: ["screenshot"],
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(typeof response.screenshot).toBe("string");
            }, lib_1.scrapeTimeout);
            it.concurrent("screenshot@fullPage format works", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    formats: ["screenshot@fullPage"],
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(typeof response.screenshot).toBe("string");
            }, lib_1.scrapeTimeout);
        });
        describe("PDF generation (f-e dependant)", () => {
            it.concurrent("works", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://firecrawl.dev",
                    timeout: lib_1.scrapeTimeout,
                    actions: [{ type: "pdf" }],
                }, identity);
                expect(response.actions?.pdfs).toBeDefined();
                expect(response.actions?.pdfs?.length).toBe(1);
                expect(response.actions?.pdfs?.[0]).toBeDefined();
                expect(typeof response.actions?.pdfs?.[0]).toBe("string");
            }, lib_1.scrapeTimeout);
        });
        describe("Proxy API (f-e dependant)", () => {
            it.concurrent("undefined works", async () => {
                await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    timeout: lib_1.scrapeTimeout,
                }, identity);
            }, lib_1.scrapeTimeout);
            it.concurrent("basic works", async () => {
                await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    proxy: "basic",
                    timeout: lib_1.scrapeTimeout,
                }, identity);
            }, lib_1.scrapeTimeout);
            it.concurrent("stealth works", async () => {
                await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    proxy: "stealth",
                    timeout: lib_1.scrapeTimeout * 2,
                }, identity);
            }, lib_1.scrapeTimeout * 2);
            it.concurrent("auto works properly on non-stealth site", async () => {
                const res = await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    proxy: "auto",
                    timeout: lib_1.scrapeTimeout * 2,
                }, identity);
                expect(res.metadata.proxyUsed).toBe("basic");
            }, lib_1.scrapeTimeout * 2);
            // TODO: flaky
            // it.concurrent("auto works properly on 'stealth' site (faked for reliabile testing)", async () => {
            //   const res = await scrape({
            //     url: "https://eo16f6718vph4un.m.pipedream.net", // always returns 403
            //     proxy: "auto",
            //     timeout: scrapeTimeout * 2,
            //   }, identity);
            //   expect(res.metadata.proxyUsed).toBe("stealth");
            // }, scrapeTimeout * 2);
        });
        describe("PDF (f-e dependant)", () => {
            // Temporarily disabled, too flaky
            // it.concurrent("works for PDFs behind anti-bot", async () => {
            //   const response = await scrape({
            //     url: "https://www.researchgate.net/profile/Amir-Leshem/publication/220732050_Robust_adaptive_beamforming_based_on_jointly_estimating_covariance_matrix_and_steering_vector/links/0c96052d2fd8f0a84b000000/Robust-adaptive-beamforming-based-on-jointly-estimating-covariance-matrix-and-steering-vector.pdf"
            //   });
            //   expect(response.markdown).toContain("Robust adaptive beamforming based on jointly estimating covariance matrix");
            // }, 60000);
            it.concurrent("blocks long PDFs with insufficient timeout", async () => {
                const response = await (0, lib_1.scrapeWithFailure)({
                    url: "https://ecma-international.org/wp-content/uploads/ECMA-262_15th_edition_june_2024.pdf",
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response.error).toContain("Insufficient time to process PDF");
            }, lib_1.scrapeTimeout);
            it.concurrent("scrapes long PDFs with sufficient timeout", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://ecma-international.org/wp-content/uploads/ECMA-262_15th_edition_june_2024.pdf",
                    timeout: lib_1.scrapeTimeout * 5,
                }, identity);
                // text on the last page
                expect(response.markdown).toContain("Redistribution and use in source and binary forms, with or without modification");
            }, lib_1.scrapeTimeout * 5);
            it.concurrent("scrapes Google Docs links as PDFs", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://docs.google.com/document/d/1H-hOLYssS8xXl2o5hxj4ipE7yyhZAX1s7ADYM1Hdlzo/view",
                    timeout: lib_1.scrapeTimeout * 5,
                }, identity);
                expect(response.markdown).toContain("This is a test to confirm Google Docs scraping abilities.");
            }, lib_1.scrapeTimeout * 5);
            it.concurrent("scrapes Google Slides links as PDFs", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "https://docs.google.com/presentation/d/1pDKL1UULpr6siq_eVWE1hjqt5MKCgSSuKS_MWahnHAQ/view",
                    timeout: lib_1.scrapeTimeout * 5,
                }, identity);
                expect(response.markdown).toContain("This is a test to confirm Google Slides scraping abilities.");
            }, lib_1.scrapeTimeout * 5);
        });
    }
    if (!process.env.TEST_SUITE_SELF_HOSTED || process.env.OPENAI_API_KEY || process.env.OLLAMA_BASE_URL) {
        describe("JSON format", () => {
            it.concurrent("works", async () => {
                const response = await (0, lib_1.scrape)({
                    url: "http://firecrawl.dev",
                    formats: ["json"],
                    jsonOptions: {
                        prompt: "Based on the information on the page, find what the company's mission is and whether it supports SSO, and whether it is open source.",
                        schema: {
                            type: "object",
                            properties: {
                                company_mission: {
                                    type: "string",
                                },
                                supports_sso: {
                                    type: "boolean",
                                },
                                is_open_source: {
                                    type: "boolean",
                                },
                            },
                            required: ["company_mission", "supports_sso", "is_open_source"],
                        },
                    },
                    timeout: lib_1.scrapeTimeout,
                }, identity);
                expect(response).toHaveProperty("json");
                expect(response.json).toHaveProperty("company_mission");
                expect(typeof response.json.company_mission).toBe("string");
                expect(response.json).toHaveProperty("supports_sso");
                expect(response.json.supports_sso).toBe(false);
                expect(typeof response.json.supports_sso).toBe("boolean");
                expect(response.json).toHaveProperty("is_open_source");
                expect(response.json.is_open_source).toBe(true);
                expect(typeof response.json.is_open_source).toBe("boolean");
            }, lib_1.scrapeTimeout);
        });
    }
    it.concurrent("sourceURL stays unnormalized", async () => {
        const response = await (0, lib_1.scrape)({
            url: "https://firecrawl.dev/?pagewanted=all&et_blog",
            timeout: lib_1.scrapeTimeout,
        }, identity);
        expect(response.metadata.sourceURL).toBe("https://firecrawl.dev/?pagewanted=all&et_blog");
    }, lib_1.scrapeTimeout);
    it.concurrent("application/json content type is markdownified properly", async () => {
        const response = await (0, lib_1.scrape)({
            url: "https://jsonplaceholder.typicode.com/todos/1",
            formats: ["markdown"],
            timeout: lib_1.scrapeTimeout,
        }, identity);
        expect(response.markdown).toContain("```json");
    }, lib_1.scrapeTimeout);
});
//# sourceMappingURL=scrape.test.js.map