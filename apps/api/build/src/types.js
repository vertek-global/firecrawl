"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = exports.RateLimiterMode = void 0;
var RateLimiterMode;
(function (RateLimiterMode) {
    RateLimiterMode["Crawl"] = "crawl";
    RateLimiterMode["CrawlStatus"] = "crawlStatus";
    RateLimiterMode["Scrape"] = "scrape";
    RateLimiterMode["ScrapeAgentPreview"] = "scrapeAgentPreview";
    RateLimiterMode["Preview"] = "preview";
    RateLimiterMode["Search"] = "search";
    RateLimiterMode["Map"] = "map";
    RateLimiterMode["Extract"] = "extract";
    RateLimiterMode["ExtractStatus"] = "extractStatus";
    RateLimiterMode["ExtractAgentPreview"] = "extractAgentPreview";
})(RateLimiterMode || (exports.RateLimiterMode = RateLimiterMode = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["APPROACHING_LIMIT"] = "approachingLimit";
    NotificationType["LIMIT_REACHED"] = "limitReached";
    NotificationType["RATE_LIMIT_REACHED"] = "rateLimitReached";
    NotificationType["AUTO_RECHARGE_SUCCESS"] = "autoRechargeSuccess";
    NotificationType["AUTO_RECHARGE_FAILED"] = "autoRechargeFailed";
    NotificationType["CONCURRENCY_LIMIT_REACHED"] = "concurrencyLimitReached";
    NotificationType["AUTO_RECHARGE_FREQUENT"] = "autoRechargeFrequent";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
//# sourceMappingURL=types.js.map