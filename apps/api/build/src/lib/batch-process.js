"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchProcess = batchProcess;
async function batchProcess(array, batchSize, asyncFunction) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
        const batch = array.slice(i, i + batchSize);
        batches.push(batch);
    }
    for (const batch of batches) {
        await Promise.all(batch.map((item, i) => asyncFunction(item, i)));
    }
}
//# sourceMappingURL=batch-process.js.map