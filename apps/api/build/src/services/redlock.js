"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redlock = void 0;
const redlock_1 = __importDefault(require("redlock"));
const ioredis_1 = __importDefault(require("ioredis"));
exports.redlock = new redlock_1.default(
// You should have one client for each independent redis node
// or cluster.
[new ioredis_1.default(process.env.REDIS_RATE_LIMIT_URL)], {
    // The expected clock drift; for more details see:
    // http://redis.io/topics/distlock
    driftFactor: 0.01, // multiplied by lock ttl to determine drift time
    retryCount: 200,
    retryDelay: 100,
    // the max time in ms randomly added to retries
    // to improve performance under high contention
    // see https://www.awsarchitectureblog.com/2015/03/backoff.html
    retryJitter: 200, // time in ms
    // The minimum remaining time on a lock before an extension is automatically
    // attempted with the `using` API.
    automaticExtensionThreshold: 500, // time in ms
});
//# sourceMappingURL=redlock.js.map