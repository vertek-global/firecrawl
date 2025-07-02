"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.areMergeable = areMergeable;
exports.mergeNullValObjs = mergeNullValObjs;
const deduplicate_objs_array_1 = require("./deduplicate-objs-array");
/**
 * Convert "null" strings to actual null values for easier comparison.
 */
function unifyValue(val) {
    return val === "null" ? null : val;
}
/**
 * Convert all "null" strings in an object to actual null values.
 */
function unifyItemValues(item) {
    const unifiedItem = {};
    for (const key of Object.keys(item)) {
        unifiedItem[key] = unifyValue(item[key]);
    }
    return unifiedItem;
}
/**
 * Check if two objects are mergeable by comparing their non-null values
 */
function areMergeable(obj1, obj2) {
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    let matchingNonNullValues = 0;
    let nonNullComparisons = 0;
    for (const key of allKeys) {
        const val1 = obj1[key];
        const val2 = obj2[key];
        // Skip array comparisons - they'll be merged separately
        if (Array.isArray(val1) || Array.isArray(val2)) {
            continue;
        }
        // If both values exist and are not null
        if (val1 !== null && val2 !== null) {
            nonNullComparisons++;
            if (val1 === val2) {
                matchingNonNullValues++;
            }
        }
    }
    // Objects are mergeable if they have at least one matching non-null value
    // and all their non-null values match when both objects have them
    return nonNullComparisons > 0 && matchingNonNullValues === nonNullComparisons;
}
/**
 * Merge arrays and remove duplicates
 */
function mergeArrays(arr1, arr2) {
    const combined = [...arr1, ...arr2];
    return combined.filter((item, index) => {
        const stringified = JSON.stringify(item);
        return (combined.findIndex((other) => JSON.stringify(other) === stringified) ===
            index);
    });
}
/**
 * Merge two objects, taking non-null values over null values
 */
function mergeObjects(obj1, obj2) {
    const result = { ...obj1 };
    for (const key in obj2) {
        if (obj2.hasOwnProperty(key)) {
            // If obj2's value is non-null, it should override obj1's value
            if (obj2[key] !== null) {
                if (Array.isArray(obj2[key])) {
                    // If both are arrays, merge them
                    if (Array.isArray(result[key])) {
                        result[key] = mergeArrays(result[key], obj2[key]);
                    }
                    else {
                        // If only obj2's value is an array, use it
                        result[key] = [...obj2[key]];
                    }
                }
                else if (typeof obj2[key] === "object") {
                    // If both are objects (but not arrays), merge them
                    if (typeof result[key] === "object" && !Array.isArray(result[key])) {
                        result[key] = mergeObjects(result[key], obj2[key]);
                    }
                    else {
                        result[key] = { ...obj2[key] };
                    }
                }
                else {
                    // For primitive values, obj2's non-null value always wins
                    result[key] = obj2[key];
                }
            }
        }
    }
    return result;
}
/**
 * Merges arrays of objects by combining those that are identical except for
 * null-equivalent fields, filling in null fields with the corresponding
 * non-null fields from the other object.
 */
function mergeNullValObjs(objArray) {
    const result = {};
    for (const key in objArray) {
        if (Array.isArray(objArray[key])) {
            // If array contains only primitive values, return as is
            if (objArray[key].every((item) => typeof item !== "object" || item === null)) {
                result[key] = [...objArray[key]];
                continue;
            }
            const items = objArray[key].map(unifyItemValues);
            const mergedItems = [];
            for (const item of items) {
                let merged = false;
                for (let i = 0; i < mergedItems.length; i++) {
                    if (areMergeable(mergedItems[i], item)) {
                        mergedItems[i] = mergeObjects(mergedItems[i], item);
                        merged = true;
                        break;
                    }
                }
                if (!merged) {
                    mergedItems.push({ ...item });
                }
            }
            // Final deduplication pass
            result[key] = (0, deduplicate_objs_array_1.deduplicateObjectsArray)({ [key]: mergedItems })[key];
        }
        else {
            console.warn(`Expected an array at objArray[${key}], but found:`, objArray[key]);
            // create an array if it doesn't exist
            if (objArray[key] === undefined) {
                objArray[key] = [];
            }
            return objArray;
        }
    }
    return result;
}
//# sourceMappingURL=merge-null-val-objs.js.map