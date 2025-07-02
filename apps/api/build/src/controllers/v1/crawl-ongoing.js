"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ongoingCrawlsController = ongoingCrawlsController;
const types_1 = require("./types");
const crawl_redis_1 = require("../../lib/crawl-redis");
const dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
async function ongoingCrawlsController(req, res) {
    const ids = await (0, crawl_redis_1.getCrawlsByTeamId)(req.auth.team_id);
    const crawls = (await Promise.all(ids.map(async (id) => ({ ...(await (0, crawl_redis_1.getCrawl)(id)), id })))).filter((crawl) => crawl !== null && !crawl.cancelled && crawl.crawlerOptions);
    res.status(200).json({
        success: true,
        crawls: crawls.map(x => ({
            id: x.id,
            teamId: x.team_id,
            url: x.originUrl,
            options: {
                ...(0, types_1.toNewCrawlerOptions)(x.crawlerOptions),
                scrapeOptions: x.scrapeOptions,
            },
        })),
    });
}
//# sourceMappingURL=crawl-ongoing.js.map