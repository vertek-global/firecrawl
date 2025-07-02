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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsecureConnectionError = void 0;
exports.makeSecureDispatcher = makeSecureDispatcher;
const undici = __importStar(require("undici"));
const ip_address_1 = require("ip-address");
const cacheableLookup_1 = require("../../lib/cacheableLookup");
const tough_cookie_1 = require("tough-cookie");
const undici_1 = require("http-cookie-agent/undici");
class InsecureConnectionError extends Error {
    constructor() {
        super("Connection violated security rules.");
    }
}
exports.InsecureConnectionError = InsecureConnectionError;
function isIPv4Private(address) {
    const parts = address.split(".").map((x) => parseInt(x, 10));
    return (parts[0] === 0 || // Current (local, "this") network
        parts[0] === 10 || // Used for local communications within a private network
        (parts[0] === 100 && parts[1] >= 64 && parts[1] < 128) || // Shared address space for communications between a service provider and its subscribers when using a carrier-grade NAT
        parts[0] === 127 || // Used for loopback addresses to the local host
        (parts[0] === 169 && parts[1] === 254) || // Used for link-local addresses between two hosts on a single link when no IP address is otherwise specified, such as would have normally been retrieved from a DHCP server
        (parts[0] === 127 && parts[1] >= 16 && parts[2] < 32) || // Used for local communications within a private network
        (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) || // IETF Porotocol Assignments, DS-Lite (/29)
        (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) || // Assigned as TEST-NET-1, documentation and examples
        (parts[0] === 192 && parts[1] === 88 && parts[2] === 99) || // Reserved. Formerly used for IPv6 to IPv4 relay (included IPv6 address block 2002::/16).
        (parts[0] === 192 && parts[1] === 168) || // Used for local communications within a private network
        (parts[0] === 192 && parts[1] >= 18 && parts[1] < 20) || // Used for benchmark testing of inter-network communications between two separate subnets
        (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) || // Assigned as TEST-NET-2, documentation and examples
        (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) || // Assigned as TEST-NET-3, documentation and examples
        (parts[0] >= 224 && parts[0] < 240) || // In use for multicast (former Class D network)
        (parts[0] === 233 && parts[1] === 252 && parts[2] === 0) || // Assigned as MCAST-TEST-NET, documentation and examples (Note that this is part of the above multicast space.)
        parts[0] >= 240 || // Reserved for future use (former class E network)
        (parts[0] === 255 &&
            parts[1] === 255 &&
            parts[2] === 255 &&
            parts[3] === 255)); // Reserved for the "limited broadcast" destination address
}
function isIPv6Private(ipv6) {
    return new ip_address_1.Address6(ipv6).getScope() !== "Global";
}
function makeSecureDispatcher(url, options) {
    const agentOpts = {
        connect: {
            rejectUnauthorized: false, // bypass SSL failures -- this is fine
            lookup: cacheableLookup_1.cacheableLookup.lookup,
        },
        maxRedirections: 5000,
        ...options,
    };
    const baseAgent = process.env.PROXY_SERVER
        ? new undici.ProxyAgent({
            uri: process.env.PROXY_SERVER.includes("://") ? process.env.PROXY_SERVER : ("http://" + process.env.PROXY_SERVER),
            token: process.env.PROXY_USERNAME
                ? `Basic ${Buffer.from(process.env.PROXY_USERNAME + ":" + (process.env.PROXY_PASSWORD ?? "")).toString("base64")}`
                : undefined,
            ...agentOpts,
        })
        : new undici.Agent(agentOpts);
    const cookieJar = new tough_cookie_1.CookieJar();
    const agent = baseAgent
        .compose((0, undici_1.cookie)({ jar: cookieJar }));
    agent.on("connect", (_, targets) => {
        const client = targets.slice(-1)[0];
        const socketSymbol = Object.getOwnPropertySymbols(client).find((x) => x.description === "socket");
        const socket = client[socketSymbol];
        if (socket.remoteAddress) {
            if (socket.remoteFamily === "IPv4"
                ? isIPv4Private(socket.remoteAddress)
                : isIPv6Private(socket.remoteAddress)) {
                socket.destroy(new InsecureConnectionError());
            }
        }
    });
    return agent;
}
//# sourceMappingURL=safeFetch.js.map