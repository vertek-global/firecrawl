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
exports.checkFireEngine = checkFireEngine;
const logger_1 = require("../../../lib/logger");
const Sentry = __importStar(require("@sentry/node"));
async function checkFireEngine(req, res) {
    try {
        if (!process.env.FIRE_ENGINE_BETA_URL) {
            logger_1.logger.warn("Fire engine beta URL not configured");
            return res.status(500).json({
                success: false,
                error: "Fire engine beta URL not configured",
            });
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const urls = ["https://roastmywebsite.ai", "https://example.com"];
        let lastError = null;
        for (const url of urls) {
            try {
                const response = await fetch(`${process.env.FIRE_ENGINE_BETA_URL}/scrape`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Disable-Cache": "true",
                    },
                    body: JSON.stringify({
                        url,
                        engine: "chrome-cdp",
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if (response.ok) {
                    const responseData = await response.json();
                    return res.status(200).json({
                        data: responseData,
                    });
                }
                lastError = `Fire engine returned status ${response.status}`;
            }
            catch (error) {
                if (error.name === "AbortError") {
                    return res.status(504).json({
                        success: false,
                        error: "Request timed out after 30 seconds",
                    });
                }
                lastError = error;
            }
        }
        // If we get here, all retries failed
        logger_1.logger.error("An error occurred while checking fire-engine", {
            module: "admin",
            method: "checkFireEngine",
            error: lastError,
        });
        Sentry.captureException(lastError);
        return res.status(500).json({
            success: false,
            error: "Internal server error - all retry attempts failed",
        });
    }
    catch (error) {
        logger_1.logger.error(error);
        Sentry.captureException(error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}
//# sourceMappingURL=check-fire-engine.js.map