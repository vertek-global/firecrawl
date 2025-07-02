"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posthog = void 0;
exports.default = PostHogClient;
const posthog_node_1 = require("posthog-node");
require("dotenv/config");
const logger_1 = require("../../src/lib/logger");
function PostHogClient(apiKey) {
    const posthogClient = new posthog_node_1.PostHog(apiKey, {
        host: process.env.POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
    });
    return posthogClient;
}
class MockPostHog {
    capture() { }
}
// Using the actual PostHog class if POSTHOG_API_KEY exists, otherwise using the mock class
// Additionally, print a warning to the terminal if POSTHOG_API_KEY is not provided
exports.posthog = process.env.POSTHOG_API_KEY
    ? PostHogClient(process.env.POSTHOG_API_KEY)
    : (() => {
        logger_1.logger.warn("POSTHOG_API_KEY is not provided - your events will not be logged. Using MockPostHog as a fallback. See posthog.ts for more.");
        return new MockPostHog();
    })();
//# sourceMappingURL=posthog.js.map