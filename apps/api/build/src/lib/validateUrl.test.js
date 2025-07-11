"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validateUrl_1 = require("./validateUrl");
const validateUrl_2 = require("./validateUrl");
describe("isSameDomain", () => {
    it("should return true for a subdomain", () => {
        const result = (0, validateUrl_1.isSameDomain)("http://sub.example.com", "http://example.com");
        expect(result).toBe(true);
    });
    it("should return true for the same domain", () => {
        const result = (0, validateUrl_1.isSameDomain)("http://example.com", "http://example.com");
        expect(result).toBe(true);
    });
    it("should return false for different domains", () => {
        const result = (0, validateUrl_1.isSameDomain)("http://example.com", "http://another.com");
        expect(result).toBe(false);
    });
    it("should return true for a subdomain with different protocols", () => {
        const result = (0, validateUrl_1.isSameDomain)("https://sub.example.com", "http://example.com");
        expect(result).toBe(true);
    });
    it("should return false for invalid URLs", () => {
        const result = (0, validateUrl_1.isSameDomain)("invalid-url", "http://example.com");
        expect(result).toBe(false);
        const result2 = (0, validateUrl_1.isSameDomain)("http://example.com", "invalid-url");
        expect(result2).toBe(false);
    });
    it("should return true for a subdomain with www prefix", () => {
        const result = (0, validateUrl_1.isSameDomain)("http://www.sub.example.com", "http://example.com");
        expect(result).toBe(true);
    });
    it("should return true for the same domain with www prefix", () => {
        const result = (0, validateUrl_1.isSameDomain)("http://docs.s.s.example.com", "http://example.com");
        expect(result).toBe(true);
    });
});
describe("isSameSubdomain", () => {
    it("should return false for a subdomain", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("http://example.com", "http://docs.example.com");
        expect(result).toBe(false);
    });
    it("should return true for the same subdomain", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("http://docs.example.com", "http://docs.example.com");
        expect(result).toBe(true);
    });
    it("should return false for different subdomains", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("http://docs.example.com", "http://blog.example.com");
        expect(result).toBe(false);
    });
    it("should return false for different domains", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("http://example.com", "http://another.com");
        expect(result).toBe(false);
    });
    it("should return false for invalid URLs", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("invalid-url", "http://example.com");
        expect(result).toBe(false);
        const result2 = (0, validateUrl_2.isSameSubdomain)("http://example.com", "invalid-url");
        expect(result2).toBe(false);
    });
    it("should return true for the same subdomain with different protocols", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("https://docs.example.com", "http://docs.example.com");
        expect(result).toBe(true);
    });
    it("should return true for the same subdomain with www prefix", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("http://www.docs.example.com", "http://docs.example.com");
        expect(result).toBe(true);
    });
    it("should return false for a subdomain with www prefix and different subdomain", () => {
        const result = (0, validateUrl_2.isSameSubdomain)("http://www.docs.example.com", "http://blog.example.com");
        expect(result).toBe(false);
    });
});
describe("removeDuplicateUrls", () => {
    it("should remove duplicate URLs with different protocols", () => {
        const urls = [
            "http://example.com",
            "https://example.com",
            "http://www.example.com",
            "https://www.example.com",
        ];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual(["https://example.com"]);
    });
    it("should keep URLs with different paths", () => {
        const urls = [
            "https://example.com/page1",
            "https://example.com/page2",
            "https://example.com/page1?param=1",
            "https://example.com/page1#section1",
        ];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual([
            "https://example.com/page1",
            "https://example.com/page2",
            "https://example.com/page1?param=1",
            "https://example.com/page1#section1",
        ]);
    });
    it("should prefer https over http", () => {
        const urls = ["http://example.com", "https://example.com"];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual(["https://example.com"]);
    });
    it("should prefer non-www over www", () => {
        const urls = ["https://www.example.com", "https://example.com"];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual(["https://example.com"]);
    });
    it("should handle empty input", () => {
        const urls = [];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual([]);
    });
    it("should handle URLs with different cases", () => {
        const urls = ["https://EXAMPLE.com", "https://example.com"];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual(["https://EXAMPLE.com"]);
    });
    it("should handle URLs with trailing slashes", () => {
        const urls = ["https://example.com", "https://example.com/"];
        const result = (0, validateUrl_1.removeDuplicateUrls)(urls);
        expect(result).toEqual(["https://example.com"]);
    });
});
//# sourceMappingURL=validateUrl.test.js.map