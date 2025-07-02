"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lib_1 = require("./lib");
let identity;
beforeAll(async () => {
    identity = await (0, lib_1.idmux)({
        name: "extract",
        concurrency: 100,
        tokens: 1000000,
    });
}, 10000);
describe("Extract tests", () => {
    if (!process.env.TEST_SUITE_SELF_HOSTED || process.env.OPENAI_API_KEY || process.env.OLLAMA_BASE_URL) {
        it.concurrent("works", async () => {
            const res = await (0, lib_1.extract)({
                urls: ["https://firecrawl.dev"],
                schema: {
                    "type": "object",
                    "properties": {
                        "company_mission": {
                            "type": "string"
                        },
                        "is_open_source": {
                            "type": "boolean"
                        }
                    },
                    "required": [
                        "company_mission",
                        "is_open_source"
                    ]
                },
                scrapeOptions: {
                    timeout: 75000,
                },
                origin: "api-sdk",
            }, identity);
            expect(res.data).toHaveProperty("company_mission");
            expect(typeof res.data.company_mission).toBe("string");
            expect(res.data).toHaveProperty("is_open_source");
            expect(typeof res.data.is_open_source).toBe("boolean");
            expect(res.data.is_open_source).toBe(true);
        }, 90000);
        it.concurrent("works with unsupported JSON schema parameters", async () => {
            const res = await (0, lib_1.extract)({
                urls: ["https://firecrawl.dev"],
                schema: {
                    "type": "object",
                    "properties": {
                        "company_name": {
                            "type": "string",
                            "pattern": "^[a-zA-Z0-9]+$"
                        },
                    },
                    "required": [
                        "company_name"
                    ]
                },
                scrapeOptions: {
                    timeout: 75000,
                },
                origin: "api-sdk",
            }, identity);
            expect(res.data).toHaveProperty("company_name");
            expect(typeof res.data.company_name).toBe("string");
        }, 90000);
    }
    else {
        it.concurrent("dummy test", () => {
            expect(true).toBe(true);
        });
    }
});
//# sourceMappingURL=extract.test.js.map