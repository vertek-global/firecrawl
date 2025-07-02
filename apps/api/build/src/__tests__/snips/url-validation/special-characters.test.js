"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../../../controllers/v1/types");
const globals_1 = require("@jest/globals");
(0, globals_1.describe)("URL Schema Validation with Special Characters", () => {
    (0, globals_1.it)("should handle URLs with special characters in query parameters", () => {
        const testUrl = "https://www.boulanger.com/c/nav-filtre/televiseur?_merchant_des~boulanger|brand~lg";
        (0, globals_1.expect)(() => types_1.url.parse(testUrl)).not.toThrow();
        const parsedUrl = types_1.url.parse(testUrl);
        (0, globals_1.expect)(parsedUrl).toContain("_merchant_des%7Eboulanger%7Cbrand%7Elg");
    });
    (0, globals_1.it)("should preserve URL structure when encoding special characters", () => {
        const testUrl = "https://example.com/path?param1=value1&param2=value~with|special&param3=normal";
        (0, globals_1.expect)(() => types_1.url.parse(testUrl)).not.toThrow();
        const parsedUrl = types_1.url.parse(testUrl);
        (0, globals_1.expect)(parsedUrl).toContain("example.com/path?");
        (0, globals_1.expect)(parsedUrl).toContain("param1=value1");
        (0, globals_1.expect)(parsedUrl).toContain("param2=value%7Ewith%7Cspecial");
        (0, globals_1.expect)(parsedUrl).toContain("param3=normal");
    });
    (0, globals_1.it)("should handle URLs with already encoded special characters", () => {
        const testUrl = "https://example.com/path?param=value%7Eencoded";
        (0, globals_1.expect)(() => types_1.url.parse(testUrl)).not.toThrow();
        const parsedUrl = types_1.url.parse(testUrl);
        (0, globals_1.expect)(parsedUrl).toContain("param=value%7Eencoded");
    });
});
//# sourceMappingURL=special-characters.test.js.map