"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebCrawler = exports.DenialReason = void 0;
const axios_1 = __importStar(require("axios"));
const cheerio_1 = require("cheerio"); // rustified
const url_1 = require("url");
const sitemap_1 = require("./sitemap");
const robots_parser_1 = __importDefault(require("robots-parser"));
const maxDepthUtils_1 = require("./utils/maxDepthUtils");
const timeout_1 = require("../../lib/timeout");
const logger_1 = require("../../lib/logger");
const https_1 = __importDefault(require("https"));
const redis_1 = require("../../services/redis");
const html_transformer_1 = require("../../lib/html-transformer");
const types_1 = require("../../controllers/v1/types");
var DenialReason;
(function (DenialReason) {
    DenialReason["DEPTH_LIMIT"] = "URL exceeds maximum crawl depth";
    DenialReason["EXCLUDE_PATTERN"] = "URL matches exclude pattern";
    DenialReason["INCLUDE_PATTERN"] = "URL does not match required include pattern";
    DenialReason["ROBOTS_TXT"] = "URL blocked by robots.txt";
    DenialReason["FILE_TYPE"] = "URL points to a file type that is not crawled";
    DenialReason["URL_PARSE_ERROR"] = "URL could not be parsed";
    DenialReason["BACKWARD_CRAWLING"] = "URL not allowed due to backward crawling restrictions";
    DenialReason["SOCIAL_MEDIA"] = "URL is a social media or email link";
    DenialReason["EXTERNAL_LINK"] = "External URL not allowed";
    DenialReason["SECTION_LINK"] = "URL contains section anchor (#)";
})(DenialReason || (exports.DenialReason = DenialReason = {}));
class WebCrawler {
    jobId;
    initialUrl;
    baseUrl;
    includes;
    excludes;
    maxCrawledLinks;
    maxCrawledDepth;
    visited = new Set();
    crawledUrls = new Map();
    limit;
    robotsTxtUrl;
    robots;
    robotsCrawlDelay = null;
    generateImgAltText;
    allowBackwardCrawling;
    allowExternalContentLinks;
    allowSubdomains;
    ignoreRobotsTxt;
    regexOnFullURL;
    logger;
    sitemapsHit = new Set();
    maxDiscoveryDepth;
    currentDiscoveryDepth;
    zeroDataRetention;
    constructor({ jobId, initialUrl, baseUrl, includes, excludes, maxCrawledLinks = 10000, limit = 10000, generateImgAltText = false, maxCrawledDepth = 10, allowBackwardCrawling = false, allowExternalContentLinks = false, allowSubdomains = false, ignoreRobotsTxt = false, regexOnFullURL = false, maxDiscoveryDepth, currentDiscoveryDepth, zeroDataRetention, }) {
        this.jobId = jobId;
        this.initialUrl = initialUrl;
        this.baseUrl = baseUrl ?? new url_1.URL(initialUrl).origin;
        this.includes = Array.isArray(includes) ? includes : [];
        this.excludes = Array.isArray(excludes) ? excludes : [];
        this.limit = limit;
        this.robotsTxtUrl = `${this.baseUrl}${this.baseUrl.endsWith("/") ? "" : "/"}robots.txt`;
        this.robots = (0, robots_parser_1.default)(this.robotsTxtUrl, "");
        // Deprecated, use limit instead
        this.maxCrawledLinks = maxCrawledLinks ?? limit;
        this.maxCrawledDepth = maxCrawledDepth ?? 10;
        this.generateImgAltText = generateImgAltText ?? false;
        this.allowBackwardCrawling = allowBackwardCrawling ?? false;
        this.allowExternalContentLinks = allowExternalContentLinks ?? false;
        this.allowSubdomains = allowSubdomains ?? false;
        this.ignoreRobotsTxt = ignoreRobotsTxt ?? false;
        this.regexOnFullURL = regexOnFullURL ?? false;
        this.zeroDataRetention = zeroDataRetention ?? false;
        this.logger = logger_1.logger.child({ crawlId: this.jobId, module: "WebCrawler", zeroDataRetention: this.zeroDataRetention });
        this.maxDiscoveryDepth = maxDiscoveryDepth;
        this.currentDiscoveryDepth = currentDiscoveryDepth ?? 0;
    }
    filterLinks(sitemapLinks, limit, maxDepth, fromMap = false) {
        const denialReasons = new Map();
        if (this.currentDiscoveryDepth === this.maxDiscoveryDepth) {
            this.logger.debug("Max discovery depth hit, filtering off all links", { currentDiscoveryDepth: this.currentDiscoveryDepth, maxDiscoveryDepth: this.maxDiscoveryDepth });
            sitemapLinks.forEach(link => {
                denialReasons.set(link, "Maximum discovery depth reached");
            });
            return { links: [], denialReasons };
        }
        // If the initial URL is a sitemap.xml, skip filtering
        if (this.initialUrl.endsWith("sitemap.xml") && fromMap) {
            return { links: sitemapLinks.slice(0, limit), denialReasons };
        }
        const filteredLinks = sitemapLinks
            .filter((link) => {
            let url;
            try {
                url = new url_1.URL(link.trim(), this.baseUrl);
            }
            catch (error) {
                this.logger.debug(`Error processing link: ${link}`, {
                    link,
                    error,
                    method: "filterLinks",
                });
                return false;
            }
            const path = url.pathname;
            const depth = (0, maxDepthUtils_1.getURLDepth)(url.toString());
            // Check if the link exceeds the maximum depth allowed
            if (depth > maxDepth) {
                if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                    this.logger.debug(`${link} DEPTH FAIL`);
                }
                denialReasons.set(link, DenialReason.DEPTH_LIMIT);
                return false;
            }
            const excincPath = this.regexOnFullURL ? link : path;
            // Check if the link should be excluded
            if (this.excludes.length > 0 && this.excludes[0] !== "") {
                if (this.excludes.some((excludePattern) => new RegExp(excludePattern).test(excincPath))) {
                    if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                        this.logger.debug(`${link} EXCLUDE FAIL`);
                    }
                    denialReasons.set(link, DenialReason.EXCLUDE_PATTERN);
                    return false;
                }
            }
            // Check if the link matches the include patterns, if any are specified
            if (this.includes.length > 0 && this.includes[0] !== "") {
                if (!this.includes.some((includePattern) => new RegExp(includePattern).test(excincPath))) {
                    if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                        this.logger.debug(`${link} INCLUDE FAIL`);
                    }
                    denialReasons.set(link, DenialReason.INCLUDE_PATTERN);
                    return false;
                }
            }
            // Normalize the initial URL and the link to account for www and non-www versions
            const normalizedInitialUrl = new url_1.URL(this.initialUrl);
            let normalizedLink;
            try {
                normalizedLink = new url_1.URL(link);
            }
            catch (_) {
                if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                    this.logger.debug(`${link} URL PARSE FAIL`);
                }
                return false;
            }
            const initialHostname = normalizedInitialUrl.hostname.replace(/^www\./, "");
            const linkHostname = normalizedLink.hostname.replace(/^www\./, "");
            // Ensure the protocol and hostname match, and the path starts with the initial URL's path
            // commented to able to handling external link on allowExternalContentLinks
            // if (linkHostname !== initialHostname) {
            //   return false;
            // }
            if (!this.allowBackwardCrawling) {
                if (!normalizedLink.pathname.startsWith(normalizedInitialUrl.pathname)) {
                    if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                        this.logger.debug(`${link} BACKWARDS FAIL ${normalizedLink.pathname} ${normalizedInitialUrl.pathname}`);
                    }
                    denialReasons.set(link, DenialReason.BACKWARD_CRAWLING);
                    return false;
                }
            }
            const isAllowed = this.ignoreRobotsTxt
                ? true
                : ((this.robots.isAllowed(link, "FireCrawlAgent") || this.robots.isAllowed(link, "FirecrawlAgent")) ?? true);
            // Check if the link is disallowed by robots.txt
            if (!isAllowed) {
                this.logger.debug(`Link disallowed by robots.txt: ${link}`, {
                    method: "filterLinks",
                    link,
                });
                if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                    this.logger.debug(`${link} ROBOTS FAIL`);
                }
                denialReasons.set(link, DenialReason.ROBOTS_TXT);
                return false;
            }
            if (this.isFile(link)) {
                if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                    this.logger.debug(`${link} FILE FAIL`);
                }
                denialReasons.set(link, DenialReason.FILE_TYPE);
                return false;
            }
            if (process.env.FIRECRAWL_DEBUG_FILTER_LINKS) {
                this.logger.debug(`${link} OK`);
            }
            return true;
        })
            .slice(0, limit);
        return { links: filteredLinks, denialReasons };
    }
    async getRobotsTxt(skipTlsVerification = false, abort) {
        let extraArgs = {};
        if (skipTlsVerification) {
            extraArgs["httpsAgent"] = new https_1.default.Agent({
                rejectUnauthorized: false,
            });
        }
        const response = await axios_1.default.get(this.robotsTxtUrl, {
            timeout: timeout_1.axiosTimeout,
            signal: abort,
            ...extraArgs,
        });
        return response.data;
    }
    importRobotsTxt(txt) {
        this.robots = (0, robots_parser_1.default)(this.robotsTxtUrl, txt);
        const delay = this.robots.getCrawlDelay("FireCrawlAgent") || this.robots.getCrawlDelay("FirecrawlAgent");
        this.robotsCrawlDelay = delay !== undefined ? delay : null;
    }
    getRobotsCrawlDelay() {
        return this.robotsCrawlDelay;
    }
    async tryGetSitemap(urlsHandler, fromMap = false, onlySitemap = false, timeout = 120000, abort, mock) {
        this.logger.debug(`Fetching sitemap links from ${this.initialUrl}`, {
            method: "tryGetSitemap",
        });
        let leftOfLimit = this.limit;
        const normalizeUrl = (url) => {
            url = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
            if (url.endsWith("/")) {
                url = url.slice(0, -1);
            }
            return url;
        };
        const _urlsHandler = async (urls) => {
            if (fromMap && onlySitemap) {
                return await urlsHandler(urls);
            }
            else {
                let filteredLinksResult = this.filterLinks([...new Set(urls)].filter(x => this.filterURL(x, this.initialUrl).allowed), leftOfLimit, this.maxCrawledDepth, fromMap);
                let filteredLinks = filteredLinksResult.links;
                leftOfLimit -= filteredLinks.length;
                let uniqueURLs = [];
                for (const url of filteredLinks) {
                    if (await redis_1.redisEvictConnection.sadd("sitemap:" + this.jobId + ":links", normalizeUrl(url))) {
                        uniqueURLs.push(url);
                    }
                }
                await redis_1.redisEvictConnection.expire("sitemap:" + this.jobId + ":links", 3600, "NX");
                if (uniqueURLs.length > 0) {
                    return await urlsHandler(uniqueURLs);
                }
            }
        };
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Sitemap fetch timeout")), timeout);
        });
        // Allow sitemaps to be cached for 48 hours if they are requested from /map
        // - mogery
        const maxAge = (fromMap && !onlySitemap) ? 48 * 60 * 60 * 1000 : 0;
        try {
            let count = (await Promise.race([
                Promise.all([
                    this.tryFetchSitemapLinks(this.initialUrl, _urlsHandler, abort, mock, maxAge),
                    ...this.robots
                        .getSitemaps()
                        .map((x) => this.tryFetchSitemapLinks(x, _urlsHandler, abort, mock, maxAge)),
                ]).then((results) => results.reduce((a, x) => a + x, 0)),
                timeoutPromise,
            ]));
            if (count > 0) {
                if (await redis_1.redisEvictConnection.sadd("sitemap:" + this.jobId + ":links", normalizeUrl(this.initialUrl))) {
                    urlsHandler([this.initialUrl]);
                }
                count++;
            }
            await redis_1.redisEvictConnection.expire("sitemap:" + this.jobId + ":links", 3600, "NX");
            return count;
        }
        catch (error) {
            if (error.message === "Sitemap fetch timeout") {
                this.logger.warn("Sitemap fetch timed out", {
                    method: "tryGetSitemap",
                    timeout,
                });
                return 0;
            }
            this.logger.error("Error fetching sitemap", {
                method: "tryGetSitemap",
                error,
            });
            return 0;
        }
    }
    filterURL(href, url) {
        let fullUrl = href;
        if (!href.startsWith("http")) {
            try {
                fullUrl = new url_1.URL(href, url).toString();
            }
            catch (_) {
                return { allowed: false, denialReason: DenialReason.URL_PARSE_ERROR };
            }
        }
        let urlObj;
        try {
            urlObj = new url_1.URL(fullUrl);
        }
        catch (_) {
            return { allowed: false, denialReason: DenialReason.URL_PARSE_ERROR };
        }
        const path = urlObj.pathname;
        if (this.isInternalLink(fullUrl)) {
            // INTERNAL LINKS
            if (!this.noSections(fullUrl)) {
                return { allowed: false, denialReason: DenialReason.SECTION_LINK };
            }
            if (this.matchesExcludes(path)) {
                return { allowed: false, denialReason: DenialReason.EXCLUDE_PATTERN };
            }
            if (!this.isRobotsAllowed(fullUrl, this.ignoreRobotsTxt)) {
                (async () => {
                    await redis_1.redisEvictConnection.sadd("crawl:" + this.jobId + ":robots_blocked", fullUrl);
                    await redis_1.redisEvictConnection.expire("crawl:" + this.jobId + ":robots_blocked", 24 * 60 * 60);
                })();
                return { allowed: false, denialReason: DenialReason.ROBOTS_TXT };
            }
            return { allowed: true, url: fullUrl };
        }
        else {
            // EXTERNAL LINKS
            if (this.isSocialMediaOrEmail(fullUrl)) {
                return { allowed: false, denialReason: DenialReason.SOCIAL_MEDIA };
            }
            if (this.matchesExcludes(fullUrl, true)) {
                return { allowed: false, denialReason: DenialReason.EXCLUDE_PATTERN };
            }
            if (this.isInternalLink(url) &&
                this.allowExternalContentLinks &&
                !this.isExternalMainPage(fullUrl)) {
                return { allowed: true, url: fullUrl };
            }
            if (this.allowSubdomains &&
                !this.isSocialMediaOrEmail(fullUrl) &&
                this.isSubdomain(fullUrl)) {
                return { allowed: true, url: fullUrl };
            }
            return { allowed: false, denialReason: DenialReason.EXTERNAL_LINK };
        }
    }
    async extractLinksFromHTMLRust(html, url) {
        const links = await (0, html_transformer_1.extractLinks)(html);
        const filteredLinks = [];
        for (const link of links) {
            const filterResult = this.filterURL(link, url);
            if (filterResult.allowed && filterResult.url) {
                filteredLinks.push(filterResult.url);
            }
        }
        return filteredLinks;
    }
    extractLinksFromHTMLCheerio(html, url) {
        let links = [];
        const $ = (0, cheerio_1.load)(html);
        $("a").each((_, element) => {
            let href = $(element).attr("href");
            if (href) {
                if (href.match(/^https?:\/[^\/]/)) {
                    href = href.replace(/^https?:\//, "$&/");
                }
                const filterResult = this.filterURL(href, url);
                if (filterResult.allowed && filterResult.url) {
                    links.push(filterResult.url);
                }
            }
        });
        // Extract links from iframes with inline src
        $("iframe").each((_, element) => {
            const src = $(element).attr("src");
            if (src && src.startsWith("data:text/html")) {
                const iframeHtml = decodeURIComponent(src.split(",")[1]);
                const iframeLinks = this.extractLinksFromHTMLCheerio(iframeHtml, url);
                links = links.concat(iframeLinks);
            }
        });
        return links;
    }
    async extractLinksFromHTML(html, url) {
        try {
            return [...new Set((await this.extractLinksFromHTMLRust(html, url)).map(x => {
                    try {
                        return new url_1.URL(x, url).href;
                    }
                    catch (e) {
                        return null;
                    }
                }).filter(x => x !== null))];
        }
        catch (error) {
            this.logger.warn("Failed to call html-transformer! Falling back to cheerio...", {
                error,
                module: "scrapeURL", method: "extractMetadata"
            });
        }
        return this.extractLinksFromHTMLCheerio(html, url);
    }
    isRobotsAllowed(url, ignoreRobotsTxt = false) {
        return ignoreRobotsTxt
            ? true
            : this.robots
                ? ((this.robots.isAllowed(url, "FireCrawlAgent") || this.robots.isAllowed(url, "FirecrawlAgent")) ?? true)
                : true;
    }
    matchesExcludes(url, onlyDomains = false) {
        return this.excludes.some((pattern) => {
            if (onlyDomains)
                return this.matchesExcludesExternalDomains(url);
            return this.excludes.some((pattern) => new RegExp(pattern).test(url));
        });
    }
    // supported formats: "example.com/blog", "https://example.com", "blog.example.com", "example.com"
    matchesExcludesExternalDomains(url) {
        try {
            const urlObj = new url_1.URL(url);
            const hostname = urlObj.hostname;
            const pathname = urlObj.pathname;
            for (let domain of this.excludes) {
                let domainObj = new url_1.URL("http://" + domain.replace(/^https?:\/\//, ""));
                let domainHostname = domainObj.hostname;
                let domainPathname = domainObj.pathname;
                if (hostname === domainHostname ||
                    hostname.endsWith(`.${domainHostname}`)) {
                    if (pathname.startsWith(domainPathname)) {
                        return true;
                    }
                }
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    isExternalMainPage(url) {
        return !Boolean(url
            .split("/")
            .slice(3)
            .filter((subArray) => subArray.length > 0).length);
    }
    noSections(link) {
        return !link.includes("#");
    }
    isInternalLink(link) {
        const urlObj = new url_1.URL(link, this.baseUrl);
        const baseDomain = new url_1.URL(this.baseUrl).hostname
            .replace(/^www\./, "")
            .trim();
        const linkDomain = urlObj.hostname.replace(/^www\./, "").trim();
        return linkDomain === baseDomain;
    }
    isSubdomain(link) {
        return new url_1.URL(link, this.baseUrl).hostname.endsWith("." + new url_1.URL(this.baseUrl).hostname.split(".").slice(-2).join("."));
    }
    isFile(url) {
        const fileExtensions = [
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".css",
            ".js",
            ".ico",
            ".svg",
            ".tiff",
            // ".pdf",
            ".zip",
            ".exe",
            ".dmg",
            ".mp4",
            ".mp3",
            ".wav",
            ".pptx",
            // ".docx",
            ".xlsx",
            // ".xml",
            ".avi",
            ".flv",
            ".woff",
            ".ttf",
            ".woff2",
            ".webp",
            ".inc",
        ];
        try {
            const urlWithoutQuery = url.split("?")[0].toLowerCase();
            return fileExtensions.some((ext) => urlWithoutQuery.endsWith(ext));
        }
        catch (error) {
            this.logger.error(`Error processing URL in isFile`, {
                method: "isFile",
                error,
            });
            return false;
        }
    }
    isSocialMediaOrEmail(url) {
        const socialMediaOrEmail = [
            "facebook.com",
            "twitter.com",
            "linkedin.com",
            "instagram.com",
            "pinterest.com",
            "mailto:",
            "github.com",
            "calendly.com",
            "discord.gg",
            "discord.com",
        ];
        return socialMediaOrEmail.some((ext) => url.includes(ext));
    }
    async tryFetchSitemapLinks(url, urlsHandler, abort, mock, maxAge) {
        const sitemapUrl = url.endsWith(".xml")
            ? url
            : `${url}${url.endsWith("/") ? "" : "/"}sitemap.xml`;
        let sitemapCount = 0;
        // Try to get sitemap from the provided URL first
        try {
            sitemapCount = await (0, sitemap_1.getLinksFromSitemap)({ sitemapUrl, urlsHandler, mode: "fire-engine", maxAge, zeroDataRetention: this.zeroDataRetention }, this.logger, this.jobId, this.sitemapsHit, abort, mock);
        }
        catch (error) {
            if (error instanceof types_1.TimeoutSignal) {
                throw error;
            }
            else {
                this.logger.debug(`Failed to fetch sitemap from ${sitemapUrl}`, {
                    method: "tryFetchSitemapLinks",
                    sitemapUrl,
                    error,
                });
            }
        }
        // If this is a subdomain, also try to get sitemap from the main domain
        try {
            const urlObj = new url_1.URL(url);
            const hostname = urlObj.hostname;
            const domainParts = hostname.split(".");
            // Check if this is a subdomain (has more than 2 parts and not www)
            if (domainParts.length > 2 && domainParts[0] !== "www") {
                // Get the main domain by taking the last two parts
                const mainDomain = domainParts.slice(-2).join(".");
                const mainDomainUrl = `${urlObj.protocol}//${mainDomain}`;
                const mainDomainSitemapUrl = `${mainDomainUrl}/sitemap.xml`;
                try {
                    // Get all links from the main domain's sitemap
                    sitemapCount += await (0, sitemap_1.getLinksFromSitemap)({
                        sitemapUrl: mainDomainSitemapUrl,
                        urlsHandler(urls) {
                            return urlsHandler(urls.filter((link) => {
                                try {
                                    const linkUrl = new url_1.URL(link);
                                    return linkUrl.hostname.endsWith(hostname);
                                }
                                catch { }
                            }));
                        },
                        mode: "fire-engine",
                        maxAge,
                        zeroDataRetention: this.zeroDataRetention,
                    }, this.logger, this.jobId, this.sitemapsHit, abort, mock);
                }
                catch (error) {
                    if (error instanceof types_1.TimeoutSignal) {
                        throw error;
                    }
                    else {
                        this.logger.debug(`Failed to fetch main domain sitemap from ${mainDomainSitemapUrl}`, { method: "tryFetchSitemapLinks", mainDomainSitemapUrl, error });
                    }
                }
            }
        }
        catch (error) {
            if (error instanceof types_1.TimeoutSignal) {
                throw error;
            }
            else {
                this.logger.debug(`Error processing main domain sitemap`, {
                    method: "tryFetchSitemapLinks",
                    url,
                    error,
                });
            }
        }
        // If no sitemap found yet, try the baseUrl as a last resort
        if (sitemapCount === 0) {
            const baseUrlSitemap = `${this.baseUrl}/sitemap.xml`;
            try {
                sitemapCount += await (0, sitemap_1.getLinksFromSitemap)({ sitemapUrl: baseUrlSitemap, urlsHandler, mode: "fire-engine", maxAge, zeroDataRetention: this.zeroDataRetention }, this.logger, this.jobId, this.sitemapsHit, abort, mock);
            }
            catch (error) {
                if (error instanceof types_1.TimeoutSignal) {
                    throw error;
                }
                else {
                    this.logger.debug(`Failed to fetch sitemap from ${baseUrlSitemap}`, {
                        method: "tryFetchSitemapLinks",
                        sitemapUrl: baseUrlSitemap,
                        error,
                    });
                    if (error instanceof axios_1.AxiosError && error.response?.status === 404) {
                        // ignore 404
                    }
                    else {
                        sitemapCount += await (0, sitemap_1.getLinksFromSitemap)({ sitemapUrl: baseUrlSitemap, urlsHandler, mode: "fire-engine", maxAge, zeroDataRetention: this.zeroDataRetention }, this.logger, this.jobId, this.sitemapsHit, abort, mock);
                    }
                }
            }
        }
        if (this.sitemapsHit.size >= 20) {
            this.logger.warn("Sitemap limit hit!", { crawlId: this.jobId, url: this.baseUrl });
        }
        return sitemapCount;
    }
}
exports.WebCrawler = WebCrawler;
//# sourceMappingURL=crawler.js.map