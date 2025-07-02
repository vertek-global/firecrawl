"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheableLookup = void 0;
const cacheable_lookup_1 = __importDefault(require("cacheable-lookup"));
const dns_1 = __importDefault(require("dns"));
exports.cacheableLookup = (process.env.SENTRY_ENVIRONMENT === "dev" ? { lookup: dns_1.default.lookup, install: () => { } } : new cacheable_lookup_1.default({}));
//# sourceMappingURL=cacheableLookup.js.map