"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const maxDepthUtils_1 = require("../maxDepthUtils");
describe("Testing getURLDepth and getAdjustedMaxDepth", () => {
    it("should return 0 for root - mendable.ai", () => {
        const enteredURL = "https://www.mendable.ai/";
        expect((0, maxDepthUtils_1.getURLDepth)(enteredURL)).toBe(0);
    });
    it("should return 0 for root - scrapethissite.com", () => {
        const enteredURL = "https://scrapethissite.com/";
        expect((0, maxDepthUtils_1.getURLDepth)(enteredURL)).toBe(0);
    });
    it("should return 1 for scrapethissite.com/pages", () => {
        const enteredURL = "https://scrapethissite.com/pages";
        expect((0, maxDepthUtils_1.getURLDepth)(enteredURL)).toBe(1);
    });
    it("should return 2 for scrapethissite.com/pages/articles", () => {
        const enteredURL = "https://scrapethissite.com/pages/articles";
        expect((0, maxDepthUtils_1.getURLDepth)(enteredURL)).toBe(2);
    });
    it("Adjusted maxDepth should return 1 for scrapethissite.com and max depth param of 1", () => {
        const enteredURL = "https://scrapethissite.com";
        expect((0, maxDepthUtils_1.getAdjustedMaxDepth)(enteredURL, 1)).toBe(1);
    });
    it("Adjusted maxDepth should return 0 for scrapethissite.com and max depth param of 0", () => {
        const enteredURL = "https://scrapethissite.com";
        expect((0, maxDepthUtils_1.getAdjustedMaxDepth)(enteredURL, 0)).toBe(0);
    });
    it("Adjusted maxDepth should return 0 for mendable.ai and max depth param of 0", () => {
        const enteredURL = "https://mendable.ai";
        expect((0, maxDepthUtils_1.getAdjustedMaxDepth)(enteredURL, 0)).toBe(0);
    });
    it("Adjusted maxDepth should return 4 for scrapethissite.com/pages/articles and max depth param of 2", () => {
        const enteredURL = "https://scrapethissite.com/pages/articles";
        expect((0, maxDepthUtils_1.getAdjustedMaxDepth)(enteredURL, 2)).toBe(4);
    });
});
//# sourceMappingURL=maxDepthUtils.test.js.map