"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queue_service_1 = require("../../../services/queue-service");
const deep_research_redis_1 = require("../../../lib/deep-research/deep-research-redis");
jest.mock("../../../services/queue-service", () => ({
    redisConnection: {
        set: jest.fn(),
        get: jest.fn(),
        expire: jest.fn(),
        pttl: jest.fn(),
    },
}));
describe("Deep Research Redis Operations", () => {
    const mockResearch = {
        id: "test-id",
        team_id: "team-1",
        createdAt: Date.now(),
        status: "processing",
        currentDepth: 0,
        maxDepth: 5,
        completedSteps: 0,
        totalExpectedSteps: 25,
        findings: [],
        sources: [],
        activities: [],
        summaries: [],
    };
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe("saveDeepResearch", () => {
        it("should save research data to Redis with TTL", async () => {
            await (0, deep_research_redis_1.saveDeepResearch)("test-id", mockResearch);
            expect(queue_service_1.redisConnection.set).toHaveBeenCalledWith("deep-research:test-id", JSON.stringify(mockResearch));
            expect(queue_service_1.redisConnection.expire).toHaveBeenCalledWith("deep-research:test-id", 6 * 60 * 60);
        });
    });
    describe("getDeepResearch", () => {
        it("should retrieve research data from Redis", async () => {
            queue_service_1.redisConnection.get.mockResolvedValue(JSON.stringify(mockResearch));
            const result = await (0, deep_research_redis_1.getDeepResearch)("test-id");
            expect(result).toEqual(mockResearch);
            expect(queue_service_1.redisConnection.get).toHaveBeenCalledWith("deep-research:test-id");
        });
        it("should return null when research not found", async () => {
            queue_service_1.redisConnection.get.mockResolvedValue(null);
            const result = await (0, deep_research_redis_1.getDeepResearch)("non-existent-id");
            expect(result).toBeNull();
        });
    });
    describe("updateDeepResearch", () => {
        it("should update existing research with new data", async () => {
            queue_service_1.redisConnection.get.mockResolvedValue(JSON.stringify(mockResearch));
            const update = {
                status: "completed",
                finalAnalysis: "Test analysis",
                activities: [
                    {
                        type: "search",
                        status: "complete",
                        message: "New activity",
                        timestamp: new Date().toISOString(),
                        depth: 1,
                    },
                ],
            };
            await (0, deep_research_redis_1.updateDeepResearch)("test-id", update);
            const expectedUpdate = {
                ...mockResearch,
                ...update,
                activities: [...mockResearch.activities, ...update.activities],
            };
            expect(queue_service_1.redisConnection.set).toHaveBeenCalledWith("deep-research:test-id", JSON.stringify(expectedUpdate));
            expect(queue_service_1.redisConnection.expire).toHaveBeenCalledWith("deep-research:test-id", 6 * 60 * 60);
        });
        it("should do nothing if research not found", async () => {
            queue_service_1.redisConnection.get.mockResolvedValue(null);
            await (0, deep_research_redis_1.updateDeepResearch)("test-id", { status: "completed" });
            expect(queue_service_1.redisConnection.set).not.toHaveBeenCalled();
            expect(queue_service_1.redisConnection.expire).not.toHaveBeenCalled();
        });
    });
    describe("getDeepResearchExpiry", () => {
        it("should return correct expiry date", async () => {
            const mockTTL = 3600000; // 1 hour in milliseconds
            queue_service_1.redisConnection.pttl.mockResolvedValue(mockTTL);
            const result = await (0, deep_research_redis_1.getDeepResearchExpiry)("test-id");
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeCloseTo(new Date().getTime() + mockTTL, -2 // Allow 100ms precision
            );
        });
    });
});
//# sourceMappingURL=deep-research-redis.test.js.map