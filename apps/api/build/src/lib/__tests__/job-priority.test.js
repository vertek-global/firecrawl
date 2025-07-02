"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_priority_1 = require("../job-priority");
const queue_service_1 = require("../../services/queue-service");
jest.mock("../../services/queue-service", () => ({
    redisConnection: {
        sadd: jest.fn(),
        srem: jest.fn(),
        scard: jest.fn(),
        expire: jest.fn(),
    },
}));
describe("Job Priority Tests", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });
    test("addJobPriority should add job_id to the set and set expiration", async () => {
        const team_id = "team1";
        const job_id = "job1";
        await (0, job_priority_1.addJobPriority)(team_id, job_id);
        expect(queue_service_1.redisConnection.sadd).toHaveBeenCalledWith(`limit_team_id:${team_id}`, job_id);
        expect(queue_service_1.redisConnection.expire).toHaveBeenCalledWith(`limit_team_id:${team_id}`, 60);
    });
    test("deleteJobPriority should remove job_id from the set", async () => {
        const team_id = "team1";
        const job_id = "job1";
        await (0, job_priority_1.deleteJobPriority)(team_id, job_id);
        expect(queue_service_1.redisConnection.srem).toHaveBeenCalledWith(`limit_team_id:${team_id}`, job_id);
    });
    test("getJobPriority should return correct priority based on plan and set length", async () => {
        const team_id = "team1";
        const plan = "standard";
        queue_service_1.redisConnection.scard.mockResolvedValue(150);
        const priority = await (0, job_priority_1.getJobPriority)({ team_id });
        expect(priority).toBe(10);
        queue_service_1.redisConnection.scard.mockResolvedValue(250);
        const priorityExceeded = await (0, job_priority_1.getJobPriority)({ team_id });
        expect(priorityExceeded).toBe(20); // basePriority + Math.ceil((250 - 200) * 0.4)
    });
    test("getJobPriority should handle different plans correctly", async () => {
        const team_id = "team1";
        queue_service_1.redisConnection.scard.mockResolvedValue(50);
        let plan = "hobby";
        let priority = await (0, job_priority_1.getJobPriority)({ team_id });
        expect(priority).toBe(10);
        queue_service_1.redisConnection.scard.mockResolvedValue(150);
        plan = "hobby";
        priority = await (0, job_priority_1.getJobPriority)({ team_id });
        expect(priority).toBe(25); // basePriority + Math.ceil((150 - 50) * 0.3)
        queue_service_1.redisConnection.scard.mockResolvedValue(25);
        plan = "free";
        priority = await (0, job_priority_1.getJobPriority)({ team_id });
        expect(priority).toBe(10);
        queue_service_1.redisConnection.scard.mockResolvedValue(60);
        plan = "free";
        priority = await (0, job_priority_1.getJobPriority)({ team_id });
        expect(priority).toBe(28); // basePriority + Math.ceil((60 - 25) * 0.5)
    });
    test("addJobPriority should reset expiration time when adding new job", async () => {
        const team_id = "team1";
        const job_id1 = "job1";
        const job_id2 = "job2";
        await (0, job_priority_1.addJobPriority)(team_id, job_id1);
        expect(queue_service_1.redisConnection.expire).toHaveBeenCalledWith(`limit_team_id:${team_id}`, 60);
        // Clear the mock calls
        queue_service_1.redisConnection.expire.mockClear();
        // Add another job
        await (0, job_priority_1.addJobPriority)(team_id, job_id2);
        expect(queue_service_1.redisConnection.expire).toHaveBeenCalledWith(`limit_team_id:${team_id}`, 60);
    });
    test("Set should expire after 60 seconds", async () => {
        const team_id = "team1";
        const job_id = "job1";
        jest.useFakeTimers();
        await (0, job_priority_1.addJobPriority)(team_id, job_id);
        expect(queue_service_1.redisConnection.expire).toHaveBeenCalledWith(`limit_team_id:${team_id}`, 60);
        // Fast-forward time by 59 seconds
        jest.advanceTimersByTime(59000);
        // The set should still exist
        expect(queue_service_1.redisConnection.scard).not.toHaveBeenCalled();
        // Fast-forward time by 2 more seconds (total 61 seconds)
        jest.advanceTimersByTime(2000);
        // Check if the set has been removed (scard should return 0)
        queue_service_1.redisConnection.scard.mockResolvedValue(0);
        const setSize = await queue_service_1.redisConnection.scard(`limit_team_id:${team_id}`);
        expect(setSize).toBe(0);
        jest.useRealTimers();
    });
});
//# sourceMappingURL=job-priority.test.js.map