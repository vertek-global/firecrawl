"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("./lib");
let identity;
beforeAll(async () => {
    identity = await (0, lib_1.idmux)({
        name: "search",
        concurrency: 100,
        credits: 1000000,
    });
}, 10000);
describe("Search tests", () => {
    it.concurrent("works", async () => {
        await (0, lib_1.search)({
            query: "firecrawl"
        }, identity);
    }, 60000);
    it.concurrent("works with scrape", async () => {
        const res = await (0, lib_1.search)({
            query: "firecrawl",
            limit: 5,
            scrapeOptions: {
                formats: ["markdown"],
            },
            timeout: 120000,
        }, identity);
        for (const doc of res) {
            expect(doc.markdown).toBeDefined();
        }
    }, 125000);
});
//# sourceMappingURL=search.test.js.map