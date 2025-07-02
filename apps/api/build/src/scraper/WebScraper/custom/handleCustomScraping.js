"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCustomScraping = handleCustomScraping;
const logger_1 = require("../../../lib/logger");
async function handleCustomScraping(text, url) {
    // Check for Readme Docs special case
    if (text.includes('<meta name="readme-deploy"') &&
        !url.includes("developers.notion.com")) {
        logger_1.logger.debug(`Special use case detected for ${url}, using Fire Engine with wait time 1000ms`);
        return {
            scraper: "fire-engine",
            url: url,
            waitAfterLoad: 1000,
            pageOptions: {
                scrollXPaths: [
                    '//*[@id="ReferencePlayground"]/section[3]/div/pre/div/div/div[5]',
                ],
            },
        };
    }
    // Check for Vanta security portals
    if (text.includes('<link href="https://static.vanta.com')) {
        logger_1.logger.debug(`Vanta link detected for ${url}, using Fire Engine with wait time 3000ms`);
        return {
            scraper: "fire-engine",
            url: url,
            waitAfterLoad: 3000,
        };
    }
    // Check for Google Drive PDF links in meta tags
    const googleDriveMetaPattern = /<meta itemprop="url" content="(https:\/\/drive\.google\.com\/file\/d\/[^"]+)"/;
    const googleDriveMetaMatch = text.match(googleDriveMetaPattern);
    if (googleDriveMetaMatch) {
        const url = googleDriveMetaMatch[1];
        logger_1.logger.debug(`Google Drive PDF link detected: ${url}`);
        const fileIdMatch = url.match(/https:\/\/drive\.google\.com\/file\/d\/([^\/]+)\/view/);
        if (fileIdMatch) {
            const fileId = fileIdMatch[1];
            const pdfUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            return {
                scraper: "pdf",
                url: pdfUrl,
            };
        }
    }
    return null;
}
//# sourceMappingURL=handleCustomScraping.js.map