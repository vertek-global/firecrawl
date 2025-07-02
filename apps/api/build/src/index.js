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
require("dotenv/config");
require("./services/sentry");
const Sentry = __importStar(require("@sentry/node"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const queue_service_1 = require("./services/queue-service");
const v0_1 = require("./routes/v0");
const os_1 = __importDefault(require("os"));
const logger_1 = require("./lib/logger");
const admin_1 = require("./routes/admin");
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const v1_1 = require("./routes/v1");
const express_ws_1 = __importDefault(require("express-ws"));
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const agentLivecastWS_1 = require("./services/agentLivecastWS");
const cacheableLookup_1 = require("./scraper/scrapeURL/lib/cacheableLookup");
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const numCPUs = process.env.ENV === "local" ? 2 : os_1.default.cpus().length;
logger_1.logger.info(`Number of CPUs: ${numCPUs} available`);
// Install cacheable lookup for all other requests
cacheableLookup_1.cacheableLookup.install(node_http_1.default.globalAgent);
cacheableLookup_1.cacheableLookup.install(node_https_1.default.globalAgent);
// Initialize Express with WebSocket support
const expressApp = (0, express_1.default)();
const ws = (0, express_ws_1.default)(expressApp);
const app = ws.app;
global.isProduction = process.env.IS_PRODUCTION === "true";
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use(body_parser_1.default.json({ limit: "10mb" }));
app.use((0, cors_1.default)()); // Add this line to enable CORS
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(`/admin/${process.env.BULL_AUTH_KEY}/queues`);
const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [
        new BullAdapter((0, queue_service_1.getScrapeQueue)()),
        new BullAdapter((0, queue_service_1.getExtractQueue)()),
        new BullAdapter((0, queue_service_1.getGenerateLlmsTxtQueue)()),
        new BullAdapter((0, queue_service_1.getDeepResearchQueue)()),
        new BullAdapter((0, queue_service_1.getBillingQueue)()),
    ],
    serverAdapter: serverAdapter,
});
app.use(`/admin/${process.env.BULL_AUTH_KEY}/queues`, serverAdapter.getRouter());
app.get("/", (req, res) => {
    res.send("SCRAPERS-JS: Hello, world! K8s!");
});
//write a simple test function
app.get("/test", async (req, res) => {
    res.send("Hello, world!");
});
// register router
app.use(v0_1.v0Router);
app.use("/v1", v1_1.v1Router);
app.use(admin_1.adminRouter);
const DEFAULT_PORT = process.env.PORT ?? 3002;
const HOST = process.env.HOST ?? "localhost";
function startServer(port = DEFAULT_PORT) {
    // Attach WebSocket proxy to the Express app
    (0, agentLivecastWS_1.attachWsProxy)(app);
    const server = app.listen(Number(port), HOST, () => {
        logger_1.logger.info(`Worker ${process.pid} listening on port ${port}`);
    });
    const exitHandler = async () => {
        logger_1.logger.info("SIGTERM signal received: closing HTTP server");
        if (process.env.IS_KUBERNETES === "true") {
            // Account for GCE load balancer drain timeout
            logger_1.logger.info("Waiting 60s for GCE load balancer drain timeout");
            await new Promise((resolve) => setTimeout(resolve, 60000));
        }
        server.close(() => {
            logger_1.logger.info("Server closed.");
            process.exit(0);
        });
    };
    process.on("SIGTERM", exitHandler);
    process.on("SIGINT", exitHandler);
    return server;
}
if (require.main === module) {
    startServer();
}
app.get(`/serverHealthCheck`, async (req, res) => {
    try {
        const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
        const [waitingJobs] = await Promise.all([scrapeQueue.getWaitingCount()]);
        const noWaitingJobs = waitingJobs === 0;
        // 200 if no active jobs, 503 if there are active jobs
        return res.status(noWaitingJobs ? 200 : 500).json({
            waitingJobs,
        });
    }
    catch (error) {
        Sentry.captureException(error);
        logger_1.logger.error(error);
        return res.status(500).json({ error: error.message });
    }
});
app.get("/serverHealthCheck/notify", async (req, res) => {
    if (process.env.SLACK_WEBHOOK_URL) {
        const treshold = 1; // The treshold value for the active jobs
        const timeout = 60000; // 1 minute // The timeout value for the check in milliseconds
        const getWaitingJobsCount = async () => {
            const scrapeQueue = (0, queue_service_1.getScrapeQueue)();
            const [waitingJobsCount] = await Promise.all([
                scrapeQueue.getWaitingCount(),
            ]);
            return waitingJobsCount;
        };
        res.status(200).json({ message: "Check initiated" });
        const checkWaitingJobs = async () => {
            try {
                let waitingJobsCount = await getWaitingJobsCount();
                if (waitingJobsCount >= treshold) {
                    setTimeout(async () => {
                        // Re-check the waiting jobs count after the timeout
                        waitingJobsCount = await getWaitingJobsCount();
                        if (waitingJobsCount >= treshold) {
                            const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
                            const message = {
                                text: `⚠️ Warning: The number of active jobs (${waitingJobsCount}) has exceeded the threshold (${treshold}) for more than ${timeout / 60000} minute(s).`,
                            };
                            const response = await fetch(slackWebhookUrl, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify(message),
                            });
                            if (!response.ok) {
                                logger_1.logger.error("Failed to send Slack notification");
                            }
                        }
                    }, timeout);
                }
            }
            catch (error) {
                Sentry.captureException(error);
                logger_1.logger.debug(error);
            }
        };
        checkWaitingJobs();
    }
});
app.get("/is-production", (req, res) => {
    res.send({ isProduction: global.isProduction });
});
app.use((err, req, res, next) => {
    if (err instanceof zod_1.ZodError) {
        if (Array.isArray(err.errors) &&
            err.errors.find((x) => x.message === "URL uses unsupported protocol")) {
            logger_1.logger.warn("Unsupported protocol error: " + JSON.stringify(req.body));
        }
        res
            .status(400)
            .json({ success: false, error: "Bad Request", details: err.errors });
    }
    else {
        next(err);
    }
});
Sentry.setupExpressErrorHandler(app);
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError &&
        "status" in err &&
        err.status === 400 &&
        "body" in err) {
        return res
            .status(400)
            .json({ success: false, error: "Bad request, malformed JSON" });
    }
    const id = res.sentry ?? (0, uuid_1.v4)();
    logger_1.logger.error("Error occurred in request! (" +
        req.path +
        ") -- ID " +
        id +
        " -- ", { error: err, errorId: id, path: req.path, teamId: req.acuc?.team_id, team_id: req.acuc?.team_id });
    res.status(500).json({
        success: false,
        error: "An unexpected error occurred. Please contact help@firecrawl.com for help. Your exception ID is " +
            id,
    });
});
logger_1.logger.info(`Worker ${process.pid} started`);
// const sq = getScrapeQueue();
// sq.on("waiting", j => ScrapeEvents.logJobEvent(j, "waiting"));
// sq.on("active", j => ScrapeEvents.logJobEvent(j, "active"));
// sq.on("completed", j => ScrapeEvents.logJobEvent(j, "completed"));
// sq.on("paused", j => ScrapeEvents.logJobEvent(j, "paused"));
// sq.on("resumed", j => ScrapeEvents.logJobEvent(j, "resumed"));
// sq.on("removed", j => ScrapeEvents.logJobEvent(j, "removed"));
// 
//# sourceMappingURL=index.js.map