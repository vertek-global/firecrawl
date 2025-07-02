"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deduplicateObjectsArray = deduplicateObjectsArray;
function deduplicateObjectsArray(objArray) {
    const deduplicatedObjArray = {};
    for (const key in objArray) {
        if (Array.isArray(objArray[key])) {
            const seen = new Set();
            deduplicatedObjArray[key] = objArray[key].filter((item) => {
                // Create a unique identifier for each item based on its properties
                const identifier = JSON.stringify(item);
                // Check if this identifier has been seen before
                if (seen.has(identifier)) {
                    return false; // Duplicate found, filter it out
                }
                // Add the identifier to the set and keep the item
                seen.add(identifier);
                return true;
            });
        }
        else {
            // If the value is not an array, just copy it as is
            deduplicatedObjArray[key] = objArray[key];
        }
    }
    return deduplicatedObjArray;
}
//# sourceMappingURL=deduplicate-objs-array.js.map