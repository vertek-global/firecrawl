"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.v0Router = void 0;
const express_1 = __importDefault(require("express"));
const crawl_1 = require("../../src/controllers/v0/crawl");
const crawl_status_1 = require("../../src/controllers/v0/crawl-status");
const scrape_1 = require("../../src/controllers/v0/scrape");
const crawlPreview_1 = require("../../src/controllers/v0/crawlPreview");
const status_1 = require("../../src/controllers/v0/status");
const search_1 = require("../../src/controllers/v0/search");
const crawl_cancel_1 = require("../../src/controllers/v0/crawl-cancel");
const keyAuth_1 = require("../../src/controllers/v0/keyAuth");
const liveness_1 = require("../controllers/v0/liveness");
const readiness_1 = require("../controllers/v0/readiness");
exports.v0Router = express_1.default.Router();
exports.v0Router.post("/v0/scrape", scrape_1.scrapeController);
exports.v0Router.post("/v0/crawl", crawl_1.crawlController);
exports.v0Router.post("/v0/crawlWebsitePreview", crawlPreview_1.crawlPreviewController);
exports.v0Router.get("/v0/crawl/status/:jobId", crawl_status_1.crawlStatusController);
exports.v0Router.delete("/v0/crawl/cancel/:jobId", crawl_cancel_1.crawlCancelController);
exports.v0Router.get("/v0/checkJobStatus/:jobId", status_1.crawlJobStatusPreviewController);
// Auth route for key based authentication
exports.v0Router.get("/v0/keyAuth", keyAuth_1.keyAuthController);
// Search routes
exports.v0Router.post("/v0/search", search_1.searchController);
// Health/Probe routes
exports.v0Router.get("/v0/health/liveness", liveness_1.livenessController);
exports.v0Router.get("/v0/health/readiness", readiness_1.readinessController);
//# sourceMappingURL=v0.js.map