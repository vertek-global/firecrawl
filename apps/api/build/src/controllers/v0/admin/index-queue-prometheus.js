"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexQueuePrometheus = indexQueuePrometheus;
const services_1 = require("../../../services");
const webhook_1 = require("../../../services/webhook");
async function indexQueuePrometheus(req, res) {
    const queueLength = await (0, services_1.getIndexInsertQueueLength)();
    const webhookQueueLength = await (0, webhook_1.getWebhookInsertQueueLength)();
    res.setHeader("Content-Type", "text/plain");
    res.send(`\
# HELP firecrawl_index_queue_length The number of items in the index insert queue
# TYPE firecrawl_index_queue_length gauge
firecrawl_index_queue_length ${queueLength}
firecrawl_webhook_queue_length ${webhookQueueLength}
`);
}
//# sourceMappingURL=index-queue-prometheus.js.map