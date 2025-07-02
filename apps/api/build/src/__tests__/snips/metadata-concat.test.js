"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extractMetadata_1 = require("../../scraper/scrapeURL/lib/extractMetadata");
const globals_1 = require("@jest/globals");
(0, globals_1.describe)("Metadata concatenation", () => {
    (0, globals_1.it)("should concatenate description field into a string while preserving arrays for other metadata fields", async () => {
        const html = `
      <html>
        <head>
          <meta name="description" content="First description">
          <meta name="description" content="Second description">
          <meta property="og:locale:alternate" content="en_US">
          <meta property="og:locale:alternate" content="fr_FR">
          <meta name="keywords" content="first keyword">
          <meta name="keywords" content="second keyword">
        </head>
        <body></body>
      </html>
    `;
        const meta = {
            url: "https://example.com",
            id: "test-id",
            logger: {
                warn: globals_1.jest.fn(),
                error: globals_1.jest.fn()
            }
        };
        const metadata = await (0, extractMetadata_1.extractMetadata)(meta, html);
        (0, globals_1.expect)(metadata.description).toBeDefined();
        (0, globals_1.expect)(Array.isArray(metadata.description)).toBe(false);
        (0, globals_1.expect)(typeof metadata.description).toBe("string");
        (0, globals_1.expect)(metadata.description).toBe("First description, Second description");
        (0, globals_1.expect)(metadata.ogLocaleAlternate).toBeDefined();
        (0, globals_1.expect)(Array.isArray(metadata.ogLocaleAlternate)).toBe(true);
        (0, globals_1.expect)(metadata.ogLocaleAlternate).toEqual(["en_US", "fr_FR"]);
        (0, globals_1.expect)(metadata.keywords).toBeDefined();
        (0, globals_1.expect)(Array.isArray(metadata.keywords)).toBe(true);
        (0, globals_1.expect)(metadata.keywords).toEqual(["first keyword", "second keyword"]);
    });
});
//# sourceMappingURL=metadata-concat.test.js.map