"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndUpdateURLForMap = exports.checkUrl = exports.checkAndUpdateURL = exports.protocolIncluded = void 0;
exports.isSameDomain = isSameDomain;
exports.isSameSubdomain = isSameSubdomain;
exports.removeDuplicateUrls = removeDuplicateUrls;
const protocolIncluded = (url) => {
    // if :// not in the start of the url assume http (maybe https?)
    // regex checks if :// appears before any .
    return /^([^.:]+:\/\/)/.test(url);
};
exports.protocolIncluded = protocolIncluded;
const getURLobj = (s) => {
    // URL fails if we dont include the protocol ie google.com
    let error = false;
    let urlObj = {};
    try {
        urlObj = new URL(s);
    }
    catch (err) {
        error = true;
    }
    return { error, urlObj };
};
const checkAndUpdateURL = (url) => {
    if (!(0, exports.protocolIncluded)(url)) {
        url = `http://${url}`;
    }
    const { error, urlObj } = getURLobj(url);
    if (error) {
        throw new Error("Invalid URL");
    }
    const typedUrlObj = urlObj;
    if (typedUrlObj.protocol !== "http:" && typedUrlObj.protocol !== "https:") {
        throw new Error("Invalid URL");
    }
    return { urlObj: typedUrlObj, url: url };
};
exports.checkAndUpdateURL = checkAndUpdateURL;
const checkUrl = (url) => {
    const { error, urlObj } = getURLobj(url);
    if (error) {
        throw new Error("Invalid URL");
    }
    const typedUrlObj = urlObj;
    if (typedUrlObj.protocol !== "http:" && typedUrlObj.protocol !== "https:") {
        throw new Error("Invalid URL");
    }
    if ((url.split(".")[0].match(/:/g) || []).length !== 1) {
        throw new Error("Invalid URL. Invalid protocol."); // for this one: http://http://example.com
    }
    return url;
};
exports.checkUrl = checkUrl;
/**
 * Same domain check
 * It checks if the domain of the url is the same as the base url
 * It accounts true for subdomains and www.subdomains
 * @param url
 * @param baseUrl
 * @returns
 */
function isSameDomain(url, baseUrl) {
    const { urlObj: urlObj1, error: error1 } = getURLobj(url);
    const { urlObj: urlObj2, error: error2 } = getURLobj(baseUrl);
    if (error1 || error2) {
        return false;
    }
    const typedUrlObj1 = urlObj1;
    const typedUrlObj2 = urlObj2;
    const cleanHostname = (hostname) => {
        return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    };
    const domain1 = cleanHostname(typedUrlObj1.hostname)
        .split(".")
        .slice(-2)
        .join(".");
    const domain2 = cleanHostname(typedUrlObj2.hostname)
        .split(".")
        .slice(-2)
        .join(".");
    return domain1 === domain2;
}
function isSameSubdomain(url, baseUrl) {
    const { urlObj: urlObj1, error: error1 } = getURLobj(url);
    const { urlObj: urlObj2, error: error2 } = getURLobj(baseUrl);
    if (error1 || error2) {
        return false;
    }
    const typedUrlObj1 = urlObj1;
    const typedUrlObj2 = urlObj2;
    const cleanHostname = (hostname) => {
        return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    };
    const domain1 = cleanHostname(typedUrlObj1.hostname)
        .split(".")
        .slice(-2)
        .join(".");
    const domain2 = cleanHostname(typedUrlObj2.hostname)
        .split(".")
        .slice(-2)
        .join(".");
    const subdomain1 = cleanHostname(typedUrlObj1.hostname)
        .split(".")
        .slice(0, -2)
        .join(".");
    const subdomain2 = cleanHostname(typedUrlObj2.hostname)
        .split(".")
        .slice(0, -2)
        .join(".");
    // Check if the domains are the same and the subdomains are the same
    return domain1 === domain2 && subdomain1 === subdomain2;
}
const checkAndUpdateURLForMap = (url) => {
    if (!(0, exports.protocolIncluded)(url)) {
        url = `http://${url}`;
    }
    // remove last slash if present
    if (url.endsWith("/")) {
        url = url.slice(0, -1);
    }
    const { error, urlObj } = getURLobj(url);
    if (error) {
        throw new Error("Invalid URL");
    }
    const typedUrlObj = urlObj;
    if (typedUrlObj.protocol !== "http:" && typedUrlObj.protocol !== "https:") {
        throw new Error("Invalid URL");
    }
    // remove any query params
    // url = url.split("?")[0].trim();
    return { urlObj: typedUrlObj, url: url };
};
exports.checkAndUpdateURLForMap = checkAndUpdateURLForMap;
function removeDuplicateUrls(urls) {
    const urlMap = new Map();
    for (const url of urls) {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol;
        const hostname = parsedUrl.hostname.replace(/^www\./, "");
        const path = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
        const key = `${hostname}${path}`;
        if (!urlMap.has(key)) {
            urlMap.set(key, url);
        }
        else {
            const existingUrl = new URL(urlMap.get(key));
            const existingProtocol = existingUrl.protocol;
            if (protocol === "https:" && existingProtocol === "http:") {
                urlMap.set(key, url);
            }
            else if (protocol === existingProtocol &&
                !parsedUrl.hostname.startsWith("www.") &&
                existingUrl.hostname.startsWith("www.")) {
                urlMap.set(key, url);
            }
        }
    }
    return [...new Set(Array.from(urlMap.values()))];
}
//# sourceMappingURL=validateUrl.js.map