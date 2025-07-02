"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexCooldown = exports.scrapeTimeout = void 0;
exports.idmux = idmux;
exports.scrape = scrape;
exports.scrapeWithFailure = scrapeWithFailure;
exports.scrapeStatusRaw = scrapeStatusRaw;
exports.scrapeStatus = scrapeStatus;
exports.crawlOngoing = crawlOngoing;
exports.asyncCrawl = asyncCrawl;
exports.asyncCrawlWaitForFinish = asyncCrawlWaitForFinish;
exports.crawlErrors = crawlErrors;
exports.crawl = crawl;
exports.batchScrape = batchScrape;
exports.map = map;
exports.expectMapToSucceed = expectMapToSucceed;
exports.extract = extract;
exports.search = search;
exports.creditUsage = creditUsage;
exports.tokenUsage = tokenUsage;
exports.concurrencyCheck = concurrencyCheck;
exports.crawlWithConcurrencyTracking = crawlWithConcurrencyTracking;
exports.batchScrapeWithConcurrencyTracking = batchScrapeWithConcurrencyTracking;
exports.zdrcleaner = zdrcleaner;
exports.deepResearch = deepResearch;
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
const supertest_1 = __importDefault(require("supertest"));
// =========================================
// Configuration
// =========================================
const TEST_URL = "http://127.0.0.1:3002";
// Due to the limited resources of the CI runner, we need to set a longer timeout for the many many scrape tests
exports.scrapeTimeout = 90000;
exports.indexCooldown = 30000;
async function idmux(req) {
    if (!process.env.IDMUX_URL) {
        if (!process.env.TEST_SUITE_SELF_HOSTED) {
            console.warn("IDMUX_URL is not set, using test API key and team ID");
        }
        return {
            apiKey: process.env.TEST_API_KEY,
            teamId: process.env.TEST_TEAM_ID,
        };
    }
    let runNumber = parseInt(process.env.GITHUB_RUN_NUMBER);
    if (isNaN(runNumber) || runNumber === null || runNumber === undefined) {
        runNumber = 0;
    }
    const res = await fetch(process.env.IDMUX_URL + "/", {
        method: "POST",
        body: JSON.stringify({
            refName: process.env.GITHUB_REF_NAME,
            runNumber,
            concurrency: req.concurrency ?? 100,
            ...req,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });
    if (!res.ok) {
        console.error(await res.text());
    }
    expect(res.ok).toBe(true);
    return await res.json();
}
// =========================================
// Scrape API
// =========================================
async function scrapeRaw(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/scrape")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
function expectScrapeToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data).toBe("object");
}
function expectScrapeToFail(response) {
    expect(response.statusCode).not.toBe(200);
    expect(response.body.success).toBe(false);
    expect(typeof response.body.error).toBe("string");
}
async function scrape(body, identity) {
    const raw = await scrapeRaw(body, identity);
    expectScrapeToSucceed(raw);
    if (body.proxy === "stealth") {
        expect(raw.body.data.metadata.proxyUsed).toBe("stealth");
    }
    else if (!body.proxy || body.proxy === "basic") {
        expect(raw.body.data.metadata.proxyUsed).toBe("basic");
    }
    return raw.body.data;
}
async function scrapeWithFailure(body, identity) {
    const raw = await scrapeRaw(body, identity);
    expectScrapeToFail(raw);
    return raw.body;
}
async function scrapeStatusRaw(jobId, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .get("/v1/scrape/" + encodeURIComponent(jobId))
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
}
async function scrapeStatus(jobId, identity) {
    const raw = await scrapeStatusRaw(jobId, identity);
    expect(raw.statusCode).toBe(200);
    expect(raw.body.success).toBe(true);
    expect(typeof raw.body.data).toBe("object");
    expect(raw.body.data).not.toBeNull();
    expect(raw.body.data).toBeDefined();
    return raw.body.data;
}
// =========================================
// Crawl API
// =========================================
async function crawlStart(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/crawl")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
async function crawlStatus(id, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .get("/v1/crawl/" + encodeURIComponent(id))
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
}
async function crawlOngoingRaw(identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .get("/v1/crawl/ongoing")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
}
async function crawlOngoing(identity) {
    const res = await crawlOngoingRaw(identity);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    return res.body;
}
function expectCrawlStartToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.id).toBe("string");
}
function expectCrawlToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.status).toBe("string");
    expect(response.body.status).toBe("completed");
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
}
async function asyncCrawl(body, identity) {
    const cs = await crawlStart(body, identity);
    expectCrawlStartToSucceed(cs);
    return cs.body;
}
async function asyncCrawlWaitForFinish(id, identity) {
    let x;
    do {
        x = await crawlStatus(id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
    } while (x.body.status === "scraping");
    expectCrawlToSucceed(x);
    return x.body;
}
async function crawlErrors(id, identity) {
    const res = await (0, supertest_1.default)(TEST_URL)
        .get("/v1/crawl/" + id + "/errors")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).not.toBe(false);
    return res.body;
}
async function crawl(body, identity) {
    const cs = await crawlStart(body, identity);
    expectCrawlStartToSucceed(cs);
    let x;
    do {
        x = await crawlStatus(cs.body.id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
    } while (x.body.status === "scraping");
    const errors = await crawlErrors(cs.body.id, identity);
    if (errors.errors.length > 0) {
        console.warn("Crawl ", cs.body.id, " had errors:", errors.errors);
    }
    expectCrawlToSucceed(x);
    return {
        ...x.body,
        id: cs.body.id,
    };
}
// =========================================
// Batch Scrape API
// =========================================
async function batchScrapeStart(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/batch/scrape")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
async function batchScrapeStatus(id, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .get("/v1/batch/scrape/" + encodeURIComponent(id))
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
}
function expectBatchScrapeStartToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.id).toBe("string");
}
function expectBatchScrapeToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.status).toBe("string");
    expect(response.body.status).toBe("completed");
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
}
async function batchScrape(body, identity) {
    const bss = await batchScrapeStart(body, identity);
    expectBatchScrapeStartToSucceed(bss);
    let x;
    do {
        x = await batchScrapeStatus(bss.body.id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
    } while (x.body.status === "scraping");
    expectBatchScrapeToSucceed(x);
    return {
        ...x.body,
        id: bss.body.id,
    };
}
// =========================================
// Map API
// =========================================
async function map(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/map")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
function expectMapToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.links)).toBe(true);
    expect(response.body.links.length).toBeGreaterThan(0);
}
// =========================================
// Extract API
// =========================================
async function extractStart(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/extract")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
async function extractStatus(id, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .get("/v1/extract/" + encodeURIComponent(id))
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
}
function expectExtractStartToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.id).toBe("string");
}
function expectExtractToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.status).toBe("string");
    expect(response.body.status).toBe("completed");
    expect(response.body).toHaveProperty("data");
}
async function extract(body, identity) {
    const es = await extractStart(body, identity);
    expectExtractStartToSucceed(es);
    let x;
    do {
        x = await extractStatus(es.body.id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
    } while (x.body.status === "processing");
    expectExtractToSucceed(x);
    return x.body;
}
// =========================================
// Search API
// =========================================
async function searchRaw(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/search")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
function expectSearchToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data).toBe("object");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
}
async function search(body, identity) {
    const raw = await searchRaw(body, identity);
    expectSearchToSucceed(raw);
    return raw.body.data;
}
// =========================================
// Billing API
// =========================================
async function creditUsage(identity) {
    const req = (await (0, supertest_1.default)(TEST_URL)
        .get("/v1/team/credit-usage")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json"));
    if (req.status !== 200) {
        throw req.body;
    }
    return req.body.data;
}
async function tokenUsage(identity) {
    return (await (0, supertest_1.default)(TEST_URL)
        .get("/v1/team/token-usage")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")).body.data;
}
// =========================================
// Concurrency API
// =========================================
async function concurrencyCheck(identity) {
    const x = (await (0, supertest_1.default)(TEST_URL)
        .get("/v1/concurrency-check")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json"));
    expect(x.statusCode).toBe(200);
    expect(x.body.success).toBe(true);
    return x.body;
}
async function crawlWithConcurrencyTracking(body, identity) {
    const cs = await crawlStart(body, identity);
    expectCrawlStartToSucceed(cs);
    let x, concurrencies = [];
    do {
        x = await crawlStatus(cs.body.id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
        concurrencies.push((await concurrencyCheck(identity)).concurrency);
    } while (x.body.status === "scraping");
    expectCrawlToSucceed(x);
    return {
        crawl: x.body,
        concurrencies,
    };
}
async function batchScrapeWithConcurrencyTracking(body, identity) {
    const cs = await batchScrapeStart(body, identity);
    expectBatchScrapeStartToSucceed(cs);
    let x, concurrencies = [];
    do {
        x = await batchScrapeStatus(cs.body.id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
        concurrencies.push((await concurrencyCheck(identity)).concurrency);
    } while (x.body.status === "scraping");
    expectBatchScrapeToSucceed(x);
    return {
        batchScrape: x.body,
        concurrencies,
    };
}
// =========================================
// ZDR API
// =========================================
async function zdrcleaner(teamId) {
    const res = await (0, supertest_1.default)(TEST_URL)
        .get(`/admin/${process.env.BULL_AUTH_KEY}/zdrcleaner`)
        .query({ teamId });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
}
// =========================================
// =========================================
async function deepResearchStart(body, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .post("/v1/deep-research")
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .set("Content-Type", "application/json")
        .send(body);
}
async function deepResearchStatus(id, identity) {
    return await (0, supertest_1.default)(TEST_URL)
        .get("/v1/deep-research/" + encodeURIComponent(id))
        .set("Authorization", `Bearer ${identity.apiKey}`)
        .send();
}
function expectDeepResearchStartToSucceed(response) {
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.id).toBe("string");
}
async function deepResearch(body, identity) {
    const ds = await deepResearchStart(body, identity);
    expectDeepResearchStartToSucceed(ds);
    let x;
    do {
        x = await deepResearchStatus(ds.body.id, identity);
        expect(x.statusCode).toBe(200);
        expect(typeof x.body.status).toBe("string");
    } while (x.body.status === "processing");
    expect(x.body.success).toBe(true);
    expect(x.body.status).toBe("completed");
    return x.body;
}
//# sourceMappingURL=lib.js.map