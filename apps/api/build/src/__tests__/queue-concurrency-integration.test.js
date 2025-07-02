"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queue_service_1 = require("../services/queue-service");
const queue_jobs_1 = require("../services/queue-jobs");
const concurrency_limit_1 = require("../lib/concurrency-limit");
const auth_1 = require("../controllers/auth");
// Mock all the dependencies
const mockAdd = jest.fn();
jest.mock("../services/queue-service", () => ({
    redisConnection: {
        zremrangebyscore: jest.fn(),
        zrangebyscore: jest.fn(),
        zadd: jest.fn(),
        zrem: jest.fn(),
        zmpop: jest.fn(),
        zcard: jest.fn(),
        smembers: jest.fn(),
    },
    getScrapeQueue: jest.fn(() => ({
        add: mockAdd,
    })),
}));
jest.mock("uuid", () => ({
    v4: jest.fn(() => "mock-uuid"),
}));
describe("Queue Concurrency Integration", () => {
    const mockTeamId = "test-team-id";
    const mockNow = Date.now();
    const defaultScrapeOptions = {
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 0,
        mobile: false,
        parsePDF: false,
        timeout: 30000,
        extract: {
            mode: "llm",
            systemPrompt: "test",
            schema: {},
        },
        extractOptions: { mode: "llm", systemPrompt: "test" },
        javascript: true,
        headers: {},
        cookies: [],
        blockResources: true,
        skipTlsVerification: false,
        removeBase64Images: true,
        fastMode: false,
        blockAds: true,
        maxAge: 0,
        storeInCache: true,
    };
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, "now").mockImplementation(() => mockNow);
    });
    describe("Single Job Addition", () => {
        const mockWebScraperOptions = {
            url: "https://test.com",
            mode: "single_urls",
            team_id: mockTeamId,
            scrapeOptions: defaultScrapeOptions,
            crawlerOptions: null,
            zeroDataRetention: false,
        };
        it("should add job directly to BullMQ when under concurrency limit", async () => {
            // Mock current active jobs to be under limit
            queue_service_1.redisConnection.zrangebyscore.mockResolvedValue([]);
            await (0, queue_jobs_1.addScrapeJob)(mockWebScraperOptions);
            // Should have checked concurrency
            expect(queue_service_1.redisConnection.zrangebyscore).toHaveBeenCalled();
            // Should have added to BullMQ
            expect(mockAdd).toHaveBeenCalled();
            // Should have added to active jobs
            expect(queue_service_1.redisConnection.zadd).toHaveBeenCalledWith(expect.stringContaining("concurrency-limiter"), expect.any(Number), expect.any(String));
        });
        it("should add job to concurrency queue when at concurrency limit", async () => {
            // Mock current active jobs to be at limit
            auth_1.getACUCTeam.mockResolvedValue({
                concurrency: 15,
            });
            const activeJobs = Array(15).fill("active-job");
            queue_service_1.redisConnection.zrangebyscore.mockResolvedValue(activeJobs);
            await (0, queue_jobs_1.addScrapeJob)(mockWebScraperOptions);
            // Should have checked concurrency
            expect(queue_service_1.redisConnection.zrangebyscore).toHaveBeenCalled();
            // Should NOT have added to BullMQ
            expect(mockAdd).not.toHaveBeenCalled();
            // Should have added to concurrency queue
            expect(queue_service_1.redisConnection.zadd).toHaveBeenCalledWith(expect.stringContaining("concurrency-limit-queue"), expect.any(Number), expect.stringContaining("mock-uuid"));
        });
    });
    describe("Batch Job Addition", () => {
        const createMockJobs = (count) => Array(count)
            .fill(null)
            .map((_, i) => ({
            data: {
                url: `https://test${i}.com`,
                mode: "single_urls",
                team_id: mockTeamId,
                scrapeOptions: defaultScrapeOptions,
                zeroDataRetention: false,
            },
            opts: {
                jobId: `job-${i}`,
                priority: 1,
            },
        }));
        it("should handle batch jobs respecting concurrency limits", async () => {
            const maxConcurrency = 15;
            auth_1.getACUCTeam.mockResolvedValue({
                concurrency: maxConcurrency,
            });
            const totalJobs = maxConcurrency + 5; // Some jobs should go to queue
            const mockJobs = createMockJobs(totalJobs);
            // Mock current active jobs to be empty
            queue_service_1.redisConnection.zrangebyscore.mockResolvedValue([]);
            await (0, queue_jobs_1.addScrapeJobs)(mockJobs);
            // Should have added maxConcurrency jobs to BullMQ
            expect(mockAdd).toHaveBeenCalledTimes(maxConcurrency);
            // Should have added remaining jobs to concurrency queue
            expect(queue_service_1.redisConnection.zadd).toHaveBeenCalledWith(expect.stringContaining("concurrency-limit-queue"), expect.any(Number), expect.any(String));
        });
        it("should handle empty job array", async () => {
            const result = await (0, queue_jobs_1.addScrapeJobs)([]);
            expect(result).toBe(true);
            expect(mockAdd).not.toHaveBeenCalled();
            expect(queue_service_1.redisConnection.zadd).not.toHaveBeenCalled();
        });
    });
    describe("Queue Worker Integration", () => {
        it("should process next queued job when active job completes", async () => {
            const mockJob = {
                id: "test-job",
                data: {
                    team_id: mockTeamId,
                    zeroDataRetention: false,
                },
            };
            // Mock a queued job
            const queuedJob = {
                id: "queued-job",
                data: { test: "data" },
                opts: {},
            };
            queue_service_1.redisConnection.zmpop.mockResolvedValueOnce([
                "key",
                [[JSON.stringify(queuedJob)]],
            ]);
            // Simulate job completion in worker
            await (0, concurrency_limit_1.removeConcurrencyLimitActiveJob)(mockTeamId, mockJob.id);
            await (0, concurrency_limit_1.cleanOldConcurrencyLimitEntries)(mockTeamId);
            const nextJob = await (0, concurrency_limit_1.takeConcurrencyLimitedJob)(mockTeamId);
            // Should have taken next job from queue
            expect(nextJob).toEqual(queuedJob);
            // Should have added new job to active jobs
            await (0, concurrency_limit_1.pushConcurrencyLimitActiveJob)(mockTeamId, nextJob.id, 2 * 60 * 1000);
            expect(queue_service_1.redisConnection.zadd).toHaveBeenCalledWith(expect.stringContaining("concurrency-limiter"), expect.any(Number), nextJob.id);
        });
        it("should handle job failure and cleanup", async () => {
            const mockJob = {
                id: "failing-job",
                data: {
                    team_id: mockTeamId,
                },
            };
            // Add job to active jobs
            await (0, concurrency_limit_1.pushConcurrencyLimitActiveJob)(mockTeamId, mockJob.id, 2 * 60 * 1000);
            // Simulate job failure and cleanup
            await (0, concurrency_limit_1.removeConcurrencyLimitActiveJob)(mockTeamId, mockJob.id);
            await (0, concurrency_limit_1.cleanOldConcurrencyLimitEntries)(mockTeamId);
            // Verify job was removed from active jobs
            expect(queue_service_1.redisConnection.zrem).toHaveBeenCalledWith(expect.stringContaining("concurrency-limiter"), mockJob.id);
        });
    });
    describe("Edge Cases", () => {
        it("should handle stalled jobs cleanup", async () => {
            const stalledTime = mockNow - 3 * 60 * 1000; // 3 minutes ago
            // Mock stalled jobs in Redis
            queue_service_1.redisConnection.zrangebyscore.mockResolvedValueOnce([
                "stalled-job",
            ]);
            await (0, concurrency_limit_1.cleanOldConcurrencyLimitEntries)(mockTeamId, mockNow);
            // Should have cleaned up stalled jobs
            expect(queue_service_1.redisConnection.zremrangebyscore).toHaveBeenCalledWith(expect.stringContaining("concurrency-limiter"), -Infinity, mockNow);
        });
        it("should handle race conditions in job queue processing", async () => {
            // Mock a race condition where job is taken by another worker
            queue_service_1.redisConnection.zmpop.mockResolvedValueOnce(null);
            const nextJob = await (0, concurrency_limit_1.takeConcurrencyLimitedJob)(mockTeamId);
            // Should handle gracefully when no job is available
            expect(nextJob).toBeNull();
        });
    });
});
//# sourceMappingURL=queue-concurrency-integration.test.js.map