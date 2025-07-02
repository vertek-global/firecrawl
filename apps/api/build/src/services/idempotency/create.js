"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIdempotencyKey = createIdempotencyKey;
const supabase_1 = require("../supabase");
const logger_1 = require("../../../src/lib/logger");
async function createIdempotencyKey(req) {
    const idempotencyKey = req.headers["x-idempotency-key"];
    if (!idempotencyKey) {
        throw new Error("No idempotency key provided in the request headers.");
    }
    const { data, error } = await supabase_1.supabase_service
        .from("idempotency_keys")
        .insert({ key: idempotencyKey });
    if (error) {
        logger_1.logger.error(`Failed to create idempotency key: ${error}`);
        throw error;
    }
    return idempotencyKey;
}
//# sourceMappingURL=create.js.map