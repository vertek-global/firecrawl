"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceTracker_F0 = void 0;
const logger_1 = require("../../../../lib/logger");
const merge_null_val_objs_f0_1 = require("./merge-null-val-objs-f0");
const transform_array_to_obj_f0_1 = require("./transform-array-to-obj-f0");
/**
 * Tracks sources through the transformation, deduplication, and merging process
 */
class SourceTracker_F0 {
    transformedResults;
    preDedupeSourceMap;
    constructor() {
        this.transformedResults = [];
        this.preDedupeSourceMap = new Map();
    }
    /**
     * Transform raw extraction results into a format that preserves source information
     */
    transformResults_F0(extractionResults, schema, withTransform = true) {
        // Handle array outputs
        if (Array.isArray(extractionResults[0]?.extract)) {
            this.transformedResults = extractionResults.map(result => ({
                transformed: result.extract,
                url: result.url
            }));
            if (withTransform) {
                // Combine all extracts to match original behavior
                const combinedExtracts = extractionResults.map(r => r.extract).flat();
                return combinedExtracts;
            }
            return this.transformedResults;
        }
        // Handle object outputs (original behavior)
        this.transformedResults = extractionResults.map(result => ({
            transformed: (0, transform_array_to_obj_f0_1.transformArrayToObject_F0)(schema, [result.extract]),
            url: result.url
        }));
        if (withTransform) {
            // Then combine all extracts and transform them together to match original behavior
            const combinedExtracts = extractionResults.map(r => r.extract);
            return (0, transform_array_to_obj_f0_1.transformArrayToObject_F0)(schema, combinedExtracts);
        }
        return this.transformedResults;
    }
    /**
     * Track sources for each item before deduplication
     */
    trackPreDeduplicationSources_F0(multiEntityResult) {
        try {
            if (Array.isArray(multiEntityResult)) {
                // Handle array outputs
                multiEntityResult.forEach((item) => {
                    const itemKey = JSON.stringify(item);
                    const matchingSources = this.transformedResults
                        .filter(result => Array.isArray(result.transformed) &&
                        result.transformed.some((resultItem) => JSON.stringify(resultItem) === itemKey))
                        .map(result => result.url);
                    this.preDedupeSourceMap.set(itemKey, matchingSources);
                });
            }
            else {
                // Handle object outputs (original behavior)
                Object.keys(multiEntityResult).forEach(key => {
                    multiEntityResult[key].forEach((item) => {
                        const itemKey = JSON.stringify(item);
                        const matchingSources = this.transformedResults
                            .filter(result => result.transformed[key]?.some((resultItem) => JSON.stringify(resultItem) === itemKey))
                            .map(result => result.url);
                        this.preDedupeSourceMap.set(itemKey, matchingSources);
                    });
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to track pre-deduplication sources`, { error });
        }
    }
    /**
     * Map sources to final deduplicated/merged items
     */
    mapSourcesToFinalItems_F0(multiEntityResult, multiEntityKeys) {
        try {
            const sources = {};
            if (Array.isArray(multiEntityResult)) {
                // Handle array outputs
                multiEntityResult.forEach((item, finalIndex) => {
                    const sourceKey = `[${finalIndex}]`;
                    const itemSources = new Set();
                    this.transformedResults.forEach(result => {
                        if (Array.isArray(result.transformed)) {
                            result.transformed.forEach((originalItem) => {
                                if ((0, merge_null_val_objs_f0_1.areMergeable_F0)(item, originalItem)) {
                                    itemSources.add(result.url);
                                }
                            });
                        }
                    });
                    sources[sourceKey] = Array.from(itemSources);
                });
            }
            else {
                // Handle object outputs (original behavior)
                multiEntityKeys.forEach(key => {
                    if (multiEntityResult[key] && Array.isArray(multiEntityResult[key])) {
                        multiEntityResult[key].forEach((item, finalIndex) => {
                            const sourceKey = `${key}[${finalIndex}]`;
                            const itemSources = new Set();
                            this.transformedResults.forEach(result => {
                                result.transformed[key]?.forEach((originalItem) => {
                                    if ((0, merge_null_val_objs_f0_1.areMergeable_F0)(item, originalItem)) {
                                        itemSources.add(result.url);
                                    }
                                });
                            });
                            sources[sourceKey] = Array.from(itemSources);
                        });
                    }
                });
            }
            return sources;
        }
        catch (error) {
            logger_1.logger.error(`Failed to map sources to final items`, { error });
            return {};
        }
    }
}
exports.SourceTracker_F0 = SourceTracker_F0;
//# sourceMappingURL=source-tracker-f0.js.map