"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cacheable_lookup_1 = __importDefault(require("cacheable-lookup"));
const node_https_1 = __importDefault(require("node:https"));
const axios_1 = __importDefault(require("axios"));
describe("DNS", () => {
    it("cached dns", async () => {
        const cachedDns = new cacheable_lookup_1.default();
        cachedDns.install(node_https_1.default.globalAgent);
        jest.spyOn(cachedDns, "lookupAsync");
        const res = await axios_1.default.get("https://example.com");
        expect(res.status).toBe(200);
        expect(cachedDns.lookupAsync).toHaveBeenCalled();
    });
});
//# sourceMappingURL=dns.test.js.map