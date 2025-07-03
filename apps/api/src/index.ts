import "dotenv/config";
import "./services/sentry";
import * as Sentry from "@sentry/node";
import express, { NextFunction, Request, Response } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import {
  getExtractQueue,
  getScrapeQueue,
  getGenerateLlmsTxtQueue,
  getDeepResearchQueue,
  getBillingQueue,
} from "./services/queue-service";
import { v0Router } from "./routes/v0";
import os from "os";
import { logger } from "./lib/logger";
import { adminRouter } from "./routes/admin";
import http from "node:http";
import https from "node:https";
import { v1Router } from "./routes/v1";
import expressWs from "express-ws";
import { attachWsProxy } from "./services/agentLivecastWS";
import { cacheableLookup } from "./scraper/scrapeURL/lib/cacheableLookup";
import { v4 as uuidv4 } from "uuid";

// Optional: if you're using global flag
global.isProduction = process.env.IS_PRODUCTION === "true";

// Install DNS cache for HTTP/HTTPS agents
cacheableLookup.install(http.globalAgent);
cacheableLookup.install(https.globalAgent);

// Initialize Express with WebSocket support
const expressApp = express();
const wsInstance = expressWs(expressApp);
const app = wsInstance.app;

// Logging CPU count
const numCPUs = process.env.ENV === "local" ? 2 : os.cpus().length;
logger.info(`Number of CPUs: ${numCPUs} available`);

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: "10mb" }));

// Bull Board UI setup
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(`/admin/${process.env.BULL_AUTH_KEY}/queues`);
createBullBoard({
  queues: [
    new BullAdapter(getScrapeQueue()),
    new BullAdapter(getExtractQueue()),
    new BullAdapter(getGenerateLlmsTxtQueue()),
    new BullAdapter(getDeepResearchQueue()),
    new BullAdapter(getBillingQueue()),
  ],
  serverAdapter,
});
app.use(`/admin/${process.env.BULL_AUTH_KEY}/queues`, serverAdapter.getRouter());

// Basic routes
app.get("/", (_req, res) => res.send("SCRAPERS-JS: Hello, world! K8s!"));
app.get("/test", (_req, res) => res.send("Hello, world!"));

// Routers
app.use(v0Router);
app.use("/v1", v1Router);
app.use(adminRouter);

// Health Check
app.get("/serverHealthCheck", async (_req, res) => {
  try {
    const scrapeQueue = getScrapeQueue();
    const waitingJobs = await scrapeQueue.getWaitingCount();
    res.status(waitingJobs === 0 ? 200 : 500).json({ waitingJobs });
  } catch (err) {
    if (err instanceof Error) {
      Sentry.captureException(err);
      logger.error(err);
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: "Unknown error occurred" });
  }
});

app.get("/serverHealthCheck/notify", async (_req, res) => {
  if (!process.env.SLACK_WEBHOOK_URL) return res.status(200).json({ message: "Slack webhook not set" });

  const threshold = 1;
  const timeout = 60000;

  const getWaitingJobsCount = async () => {
    const count = await getScrapeQueue().getWaitingCount();
    return count;
  };

  res.status(200).json({ message: "Check initiated" });

  const waitingJobs = await getWaitingJobsCount();
  if (waitingJobs >= threshold) {
    setTimeout(async () => {
      const postWaitCount = await getWaitingJobsCount();
      if (postWaitCount >= threshold) {
        await fetch(process.env.SLACK_WEBHOOK_URL!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `⚠️ Warning: ${postWaitCount} jobs still waiting after 1 minute.`,
          }),
        });
      }
    }, timeout);
  }
});

app.get("/is-production", (_req, res) => {
  res.send({ isProduction: global.isProduction });
});

// Attach WebSocket proxy
attachWsProxy(app);

// Graceful shutdown
const DEFAULT_PORT = process.env.PORT ?? 3002;
const HOST = process.env.HOST ?? "localhost";

function startServer(port = DEFAULT_PORT) {
  const server = app.listen(Number(port), HOST, () => {
    logger.info(`Worker ${process.pid} listening on port ${port}`);
  });

  const exitHandler = async () => {
    logger.info("SIGTERM received. Closing server...");
    if (process.env.IS_KUBERNETES === "true") {
      logger.info("Waiting 60s for GCE load balancer drain timeout...");
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
    server.close(() => {
      logger.info("Server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", exitHandler);
  process.on("SIGINT", exitHandler);
}

if (require.main === module) {
  startServer();
}

// ---- Global Error Handling ----

import { ZodError } from "zod";
import { ErrorResponse, RequestWithMaybeACUC, ResponseWithSentry } from "./controllers/v1/types";

// Zod error middleware
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    logger.warn("Zod validation error: ", err.errors);
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      details: err.errors,
    });
  }
  next(err);
});

Sentry.setupExpressErrorHandler(app);

app.use(
  (
    err: unknown,
    req: RequestWithMaybeACUC,
    res: ResponseWithSentry,
    _next: NextFunction,
  ) => {
    const id = res.sentry ?? uuidv4();
    logger.error("Unhandled error", {
      error: err,
      errorId: id,
      path: req.path,
      teamId: req.acuc?.team_id,
    });

    (res as Response).status(500).json({
      success: false,
      error: `An unexpected error occurred. Please contact help@firecrawl.com. Error ID: ${id}`,
    });
  },
);

logger.info(`Worker ${process.pid} started`);
