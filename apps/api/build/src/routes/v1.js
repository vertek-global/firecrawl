"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.v1Router = void 0;
exports.authMiddleware = authMiddleware;
exports.wrap = wrap;
const express_1 = __importDefault(require("express"));
const crawl_1 = require("../controllers/v1/crawl");
// import { crawlStatusController } from "../../src/controllers/v1/crawl-status";
const scrape_1 = require("../../src/controllers/v1/scrape");
const crawl_status_1 = require("../controllers/v1/crawl-status");
const map_1 = require("../controllers/v1/map");
const types_1 = require("../controllers/v1/types");
const types_2 = require("../types");
const auth_1 = require("../controllers/auth");
const create_1 = require("../services/idempotency/create");
const validate_1 = require("../services/idempotency/validate");
const credit_billing_1 = require("../services/billing/credit_billing");
const express_ws_1 = __importDefault(require("express-ws"));
const crawl_status_ws_1 = require("../controllers/v1/crawl-status-ws");
const blocklist_1 = require("../scraper/WebScraper/utils/blocklist");
const crawl_cancel_1 = require("../controllers/v1/crawl-cancel");
const logger_1 = require("../lib/logger");
const scrape_status_1 = require("../controllers/v1/scrape-status");
const concurrency_check_1 = require("../controllers/v1/concurrency-check");
const batch_scrape_1 = require("../controllers/v1/batch-scrape");
const extract_1 = require("../controllers/v1/extract");
const extract_status_1 = require("../controllers/v1/extract-status");
const credit_usage_1 = require("../controllers/v1/credit-usage");
const strings_1 = require("../lib/strings");
const search_1 = require("../controllers/v1/search");
const crawl_errors_1 = require("../controllers/v1/crawl-errors");
const generate_llmstxt_1 = require("../controllers/v1/generate-llmstxt");
const generate_llmstxt_status_1 = require("../controllers/v1/generate-llmstxt-status");
const deep_research_1 = require("../controllers/v1/deep-research");
const deep_research_status_1 = require("../controllers/v1/deep-research-status");
const token_usage_1 = require("../controllers/v1/token-usage");
const crawl_ongoing_1 = require("../controllers/v1/crawl-ongoing");
function checkCreditsMiddleware(_minimum) {
    return (req, res, next) => {
        let minimum = _minimum;
        (async () => {
            if (!minimum && req.body) {
                minimum =
                    req.body?.limit ?? req.body?.urls?.length ?? 1;
            }
            const { success, remainingCredits, chunk } = await (0, credit_billing_1.checkTeamCredits)(req.acuc, req.auth.team_id, minimum ?? 1);
            if (chunk) {
                req.acuc = chunk;
            }
            req.account = { remainingCredits };
            if (!success) {
                if (!minimum && req.body && req.body.limit !== undefined && remainingCredits > 0) {
                    logger_1.logger.warn("Adjusting limit to remaining credits", {
                        teamId: req.auth.team_id,
                        remainingCredits,
                        request: req.body,
                    });
                    req.body.limit = remainingCredits;
                    return next();
                }
                const currencyName = req.acuc.is_extract ? "tokens" : "credits";
                logger_1.logger.error(`Insufficient ${currencyName}: ${JSON.stringify({ team_id: req.auth.team_id, minimum, remainingCredits })}`, {
                    teamId: req.auth.team_id,
                    minimum,
                    remainingCredits,
                    request: req.body,
                    path: req.path
                });
                if (!res.headersSent && req.auth.team_id !== "8c528896-7882-4587-a4b6-768b721b0b53") {
                    return res.status(402).json({
                        success: false,
                        error: "Insufficient " + currencyName + " to perform this request. For more " + currencyName + ", you can upgrade your plan at " + (currencyName === "credits" ? "https://firecrawl.dev/pricing or try changing the request limit to a lower value" : "https://www.firecrawl.dev/extract#pricing") + ".",
                    });
                }
            }
            next();
        })().catch((err) => next(err));
    };
}
function authMiddleware(rateLimiterMode) {
    return (req, res, next) => {
        (async () => {
            let currentRateLimiterMode = rateLimiterMode;
            if (currentRateLimiterMode === types_2.RateLimiterMode.Extract && (0, types_1.isAgentExtractModelValid)(req.body?.agent?.model)) {
                currentRateLimiterMode = types_2.RateLimiterMode.ExtractAgentPreview;
            }
            // if (currentRateLimiterMode === RateLimiterMode.Scrape && isAgentExtractModelValid((req.body as any)?.agent?.model)) {
            //   currentRateLimiterMode = RateLimiterMode.ScrapeAgentPreview;
            // }
            const auth = await (0, auth_1.authenticateUser)(req, res, currentRateLimiterMode);
            if (!auth.success) {
                if (!res.headersSent) {
                    return res
                        .status(auth.status)
                        .json({ success: false, error: auth.error });
                }
                else {
                    return;
                }
            }
            const { team_id, chunk } = auth;
            req.auth = { team_id };
            req.acuc = chunk ?? undefined;
            if (chunk) {
                req.account = { remainingCredits: chunk.remaining_credits };
            }
            next();
        })().catch((err) => next(err));
    };
}
function idempotencyMiddleware(req, res, next) {
    (async () => {
        if (req.headers["x-idempotency-key"]) {
            const isIdempotencyValid = await (0, validate_1.validateIdempotencyKey)(req);
            if (!isIdempotencyValid) {
                if (!res.headersSent) {
                    return res
                        .status(409)
                        .json({ success: false, error: "Idempotency key already used" });
                }
            }
            (0, create_1.createIdempotencyKey)(req);
        }
        next();
    })().catch((err) => next(err));
}
function blocklistMiddleware(req, res, next) {
    if (typeof req.body.url === "string" && (0, blocklist_1.isUrlBlocked)(req.body.url, req.acuc?.flags ?? null)) {
        if (!res.headersSent) {
            return res.status(403).json({
                success: false,
                error: strings_1.BLOCKLISTED_URL_MESSAGE,
            });
        }
    }
    next();
}
function wrap(controller) {
    return (req, res, next) => {
        controller(req, res).catch((err) => next(err));
    };
}
(0, express_ws_1.default)((0, express_1.default)());
exports.v1Router = express_1.default.Router();
exports.v1Router.post("/scrape", authMiddleware(types_2.RateLimiterMode.Scrape), checkCreditsMiddleware(1), blocklistMiddleware, wrap(scrape_1.scrapeController));
exports.v1Router.post("/crawl", authMiddleware(types_2.RateLimiterMode.Crawl), checkCreditsMiddleware(), blocklistMiddleware, idempotencyMiddleware, wrap(crawl_1.crawlController));
exports.v1Router.post("/batch/scrape", authMiddleware(types_2.RateLimiterMode.Scrape), checkCreditsMiddleware(), blocklistMiddleware, idempotencyMiddleware, wrap(batch_scrape_1.batchScrapeController));
exports.v1Router.post("/search", authMiddleware(types_2.RateLimiterMode.Search), checkCreditsMiddleware(), wrap(search_1.searchController));
exports.v1Router.post("/map", authMiddleware(types_2.RateLimiterMode.Map), checkCreditsMiddleware(1), blocklistMiddleware, wrap(map_1.mapController));
exports.v1Router.get("/crawl/ongoing", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(crawl_ongoing_1.ongoingCrawlsController));
// Public facing, same as ongoing
exports.v1Router.get("/crawl/active", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(crawl_ongoing_1.ongoingCrawlsController));
exports.v1Router.get("/crawl/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(crawl_status_1.crawlStatusController));
exports.v1Router.get("/batch/scrape/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), 
// Yes, it uses the same controller as the normal crawl status controller
wrap((req, res) => (0, crawl_status_1.crawlStatusController)(req, res, true)));
exports.v1Router.get("/crawl/:jobId/errors", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(crawl_errors_1.crawlErrorsController));
exports.v1Router.get("/batch/scrape/:jobId/errors", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(crawl_errors_1.crawlErrorsController));
exports.v1Router.get("/scrape/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(scrape_status_1.scrapeStatusController));
exports.v1Router.get("/concurrency-check", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(concurrency_check_1.concurrencyCheckController));
exports.v1Router.ws("/crawl/:jobId", crawl_status_ws_1.crawlStatusWSController);
exports.v1Router.post("/extract", authMiddleware(types_2.RateLimiterMode.Extract), checkCreditsMiddleware(1), wrap(extract_1.extractController));
exports.v1Router.get("/extract/:jobId", authMiddleware(types_2.RateLimiterMode.ExtractStatus), wrap(extract_status_1.extractStatusController));
exports.v1Router.post("/llmstxt", authMiddleware(types_2.RateLimiterMode.Scrape), blocklistMiddleware, wrap(generate_llmstxt_1.generateLLMsTextController));
exports.v1Router.get("/llmstxt/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(generate_llmstxt_status_1.generateLLMsTextStatusController));
exports.v1Router.post("/deep-research", authMiddleware(types_2.RateLimiterMode.Crawl), checkCreditsMiddleware(1), wrap(deep_research_1.deepResearchController));
exports.v1Router.get("/deep-research/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(deep_research_status_1.deepResearchStatusController));
// v1Router.post("/crawlWebsitePreview", crawlPreviewController);
exports.v1Router.delete("/crawl/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), crawl_cancel_1.crawlCancelController);
exports.v1Router.delete("/batch/scrape/:jobId", authMiddleware(types_2.RateLimiterMode.CrawlStatus), crawl_cancel_1.crawlCancelController);
// v1Router.get("/checkJobStatus/:jobId", crawlJobStatusPreviewController);
// // Auth route for key based authentication
// v1Router.get("/keyAuth", keyAuthController);
// // Search routes
// v0Router.post("/search", searchController);
// Health/Probe routes
// v1Router.get("/health/liveness", livenessController);
// v1Router.get("/health/readiness", readinessController);
exports.v1Router.get("/team/credit-usage", authMiddleware(types_2.RateLimiterMode.CrawlStatus), wrap(credit_usage_1.creditUsageController));
exports.v1Router.get("/team/token-usage", authMiddleware(types_2.RateLimiterMode.ExtractStatus), wrap(token_usage_1.tokenUsageController));
//# sourceMappingURL=v1.js.map