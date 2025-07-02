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
exports.fire_engine_search = fire_engine_search;
exports.fireEngineMap = fireEngineMap;
const dotenv_1 = __importDefault(require("dotenv"));
const Sentry = __importStar(require("@sentry/node"));
const logger_1 = require("../lib/logger");
dotenv_1.default.config();
async function fire_engine_search(q, options, abort) {
    try {
        let data = JSON.stringify({
            query: q,
            lang: options.lang,
            country: options.country,
            location: options.location,
            tbs: options.tbs,
            numResults: options.numResults,
            page: options.page ?? 1,
        });
        if (!process.env.FIRE_ENGINE_BETA_URL) {
            return [];
        }
        const response = await fetch(`${process.env.FIRE_ENGINE_BETA_URL}/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Disable-Cache": "true",
            },
            body: data,
            signal: abort,
        });
        if (response.ok) {
            const responseData = await response.json();
            return responseData;
        }
        else {
            return [];
        }
    }
    catch (error) {
        logger_1.logger.error(error);
        Sentry.captureException(error);
        return [];
    }
}
async function fireEngineMap(q, options, abort) {
    try {
        let data = JSON.stringify({
            query: q,
            lang: options.lang,
            country: options.country,
            location: options.location,
            tbs: options.tbs,
            numResults: options.numResults,
            page: options.page ?? 1,
        });
        if (!process.env.FIRE_ENGINE_BETA_URL) {
            logger_1.logger.warn("(v1/map Beta) Results might differ from cloud offering currently.");
            return [];
        }
        const response = await fetch(`${process.env.FIRE_ENGINE_BETA_URL}/map`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Disable-Cache": "true",
            },
            body: data,
            signal: abort,
        });
        if (response.ok) {
            const responseData = await response.json();
            return responseData;
        }
        else {
            return [];
        }
    }
    catch (error) {
        logger_1.logger.error(error);
        Sentry.captureException(error);
        return [];
    }
}
//# sourceMappingURL=fireEngine.js.map