"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const canonical_url_1 = require("./canonical-url");
describe("normalizeUrlOnlyHostname", () => {
    it("should remove protocol and www from URL", () => {
        const url = "https://www.example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should remove only protocol if www is not present", () => {
        const url = "https://example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should handle URLs without protocol", () => {
        const url = "www.example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should handle URLs without protocol and www", () => {
        const url = "example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should handle URLs with paths", () => {
        const url = "https://www.example.com/path/to/resource";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should handle invalid URLs gracefully", () => {
        const url = "not a valid url";
        const expected = "not a valid url";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should handle URLs with subdomains", () => {
        const url = "https://blog.example.com";
        const expected = "blog.example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
    it("should handle URLs with multiple subdomains", () => {
        const url = "https://dev.blog.example.com";
        const expected = "dev.blog.example.com";
        expect((0, canonical_url_1.normalizeUrlOnlyHostname)(url)).toBe(expected);
    });
});
describe("normalizeUrl", () => {
    it("should remove protocol and www from URL", () => {
        const url = "https://www.example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should remove only protocol if www is not present", () => {
        const url = "https://example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should handle URLs without protocol", () => {
        const url = "www.example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should handle URLs without protocol and www", () => {
        const url = "example.com";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should handle URLs with paths", () => {
        const url = "https://www.example.com/path/to/resource";
        const expected = "example.com/path/to/resource";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should handle URLs with trailing slash", () => {
        const url = "https://www.example.com/";
        const expected = "example.com";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should handle URLs with trailing slash and path", () => {
        const url = "https://www.example.com/path/";
        const expected = "example.com/path";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
    it("should handle invalid URLs gracefully", () => {
        const url = "not a valid url";
        const expected = "not a valid url";
        expect((0, canonical_url_1.normalizeUrl)(url)).toBe(expected);
    });
});
//# sourceMappingURL=canonical-url.test.js.map