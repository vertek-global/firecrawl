"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crawl_1 = require("../v0/crawl");
const validate_1 = require("../../services/idempotency/validate");
const uuid_1 = require("uuid");
jest.mock("../auth", () => ({
    authenticateUser: jest.fn().mockResolvedValue({
        success: true,
        team_id: "team123",
        error: null,
        status: 200,
    }),
    reduce: jest.fn(),
}));
jest.mock("../../services/idempotency/validate");
describe("crawlController", () => {
    it("should prevent duplicate requests using the same idempotency key", async () => {
        const req = {
            headers: {
                "x-idempotency-key": await (0, uuid_1.v4)(),
                Authorization: `Bearer ${process.env.TEST_API_KEY}`,
            },
            body: {
                url: "https://mendable.ai",
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        // Mock the idempotency key validation to return false for the second call
        validate_1.validateIdempotencyKey
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        // First request should succeed
        await (0, crawl_1.crawlController)(req, res);
        expect(res.status).not.toHaveBeenCalledWith(409);
        // Second request with the same key should fail
        await (0, crawl_1.crawlController)(req, res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            error: "Idempotency key already used",
        });
    });
});
//# sourceMappingURL=crawl.test.js.map