"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("./lib");
let identity;
beforeAll(async () => {
    identity = await (0, lib_1.idmux)({
        name: "map",
        concurrency: 100,
        credits: 1000000,
    });
}, 10000);
describe("Map tests", () => {
    it.concurrent("basic map succeeds", async () => {
        const response = await (0, lib_1.map)({
            url: "http://firecrawl.dev",
        }, identity);
        (0, lib_1.expectMapToSucceed)(response);
    }, 60000);
    it.concurrent("times out properly", async () => {
        const response = await (0, lib_1.map)({
            url: "http://firecrawl.dev",
            timeout: 1
        }, identity);
        expect(response.statusCode).toBe(408);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe("Request timed out");
    }, 10000);
    it.concurrent("handles query parameters correctly", async () => {
        let response = await (0, lib_1.map)({
            url: "https://www.hfea.gov.uk",
            sitemapOnly: true,
            useMock: "map-query-params",
        }, identity);
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.links.some(x => x.match(/^https:\/\/www\.hfea\.gov\.uk\/choose-a-clinic\/clinic-search\/results\/?\?options=\d+$/))).toBe(true);
    }, 60000);
});
//# sourceMappingURL=map.test.js.map