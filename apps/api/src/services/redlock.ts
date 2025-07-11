import Redlock from "redlock";
import Client from "ioredis";

export const redlock = new Redlock(
  // You should have one client for each independent redis node
  // or cluster.
  [new Client(process.env.REDIS_RATE_LIMIT_URL!, { family: 0 })],
  {
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
  },
);
