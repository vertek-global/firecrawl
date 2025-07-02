"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// crawler.test.ts
const crawler_1 = require("../crawler");
const axios_1 = __importDefault(require("axios"));
const robots_parser_1 = __importDefault(require("robots-parser"));
jest.mock("axios");
jest.mock("robots-parser");
describe("WebCrawler", () => {
    let crawler;
    const mockAxios = axios_1.default;
    const mockRobotsParser = robots_parser_1.default;
    let maxCrawledDepth;
    beforeEach(() => {
        // Setup default mocks
        mockAxios.get.mockImplementation((url) => {
            if (url.includes("robots.txt")) {
                return Promise.resolve({ data: "User-agent: *\nAllow: /" });
            }
            else if (url.includes("sitemap.xml")) {
                return Promise.resolve({ data: "sitemap content" }); // You would normally parse this to URLs
            }
            return Promise.resolve({ data: "<html></html>" });
        });
        mockRobotsParser.mockReturnValue({
            isAllowed: jest.fn().mockReturnValue(true),
            isDisallowed: jest.fn().mockReturnValue(false),
            getMatchingLineNumber: jest.fn().mockReturnValue(0),
            getCrawlDelay: jest.fn().mockReturnValue(0),
            getSitemaps: jest.fn().mockReturnValue([]),
            getPreferredHost: jest.fn().mockReturnValue("example.com"),
        });
    });
    it("should respect the limit parameter by not returning more links than specified", async () => {
        const initialUrl = "http://example.com";
        const limit = 2; // Set a limit for the number of links
        crawler = new crawler_1.WebCrawler({
            jobId: "TEST",
            initialUrl: initialUrl,
            includes: [],
            excludes: [],
            limit: limit, // Apply the limit
            maxCrawledDepth: 10,
        });
        // Mock sitemap fetching function to return more links than the limit
        crawler["tryFetchSitemapLinks"] = jest
            .fn()
            .mockResolvedValue([
            initialUrl,
            initialUrl + "/page1",
            initialUrl + "/page2",
            initialUrl + "/page3",
        ]);
        const filteredLinks = crawler["filterLinks"]([
            initialUrl,
            initialUrl + "/page1",
            initialUrl + "/page2",
            initialUrl + "/page3",
        ], limit, 10);
        expect(filteredLinks.links.length).toBe(limit); // Check if the number of results respects the limit
        expect(filteredLinks.links).toEqual([initialUrl, initialUrl + "/page1"]);
    });
});
//# sourceMappingURL=crawler.test.js.map