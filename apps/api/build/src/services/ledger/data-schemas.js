"use strict";
/**
 * This file defines the data schemas for events tracked in the ledger system.
 * These interfaces represent the structure of the 'data' JSONB column in ledger.tracks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventData = createEventData;
/**
 * Creates a properly typed event data object with current timestamp
 */
function createEventData(eventType, data) {
    return {
        ...data,
    };
}
//# sourceMappingURL=data-schemas.js.map