"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformArrayToObject = transformArrayToObject;
const isEqual_1 = __importDefault(require("lodash/isEqual"));
/**
 * Transforms an array of objects into a single object, merging properties with the same name.
 * @param originalSchema - The schema of the original data.
 * @param arrayData - The array of objects to transform.
 * @returns A single object with merged properties.
 */
function transformArrayToObject(originalSchema, arrayData) {
    if (Object.keys(originalSchema).length == 0) {
        return {};
    }
    const transformedResult = {};
    // Function to find the array key in a nested schema
    function findArrayKey(schema) {
        for (const key in schema.properties) {
            if (schema.properties[key].type === "array") {
                return key;
            }
            else if (schema.properties[key].type === "object") {
                const nestedKey = findArrayKey(schema.properties[key]);
                if (nestedKey) {
                    return `${key}.${nestedKey}`;
                }
            }
        }
        return null;
    }
    const arrayKeyPath = findArrayKey(originalSchema);
    if (!arrayKeyPath) {
        return arrayData.reduce((acc, item) => {
            for (const key in item) {
                if (!acc[key]) {
                    acc[key] = item[key];
                }
                else if (typeof acc[key] === "object" &&
                    typeof item[key] === "object") {
                    acc[key] = { ...acc[key], ...item[key] };
                }
            }
            return acc;
        }, {});
    }
    const arrayKeyParts = arrayKeyPath.split(".");
    const arrayKey = arrayKeyParts.pop();
    if (!arrayKey) {
        throw new Error("Array key not found in schema");
    }
    const parentSchema = arrayKeyParts.reduce((schema, key) => schema.properties[key], originalSchema);
    const itemSchema = parentSchema.properties[arrayKey].items;
    if (!itemSchema) {
        throw new Error("Item schema not found for array key");
    }
    // Initialize the array in the transformed result
    let currentLevel = transformedResult;
    arrayKeyParts.forEach((part) => {
        if (!currentLevel[part]) {
            currentLevel[part] = {};
        }
        currentLevel = currentLevel[part];
    });
    currentLevel[arrayKey] = [];
    // Helper function to check if an object is already in the array
    function isDuplicateObject(array, obj) {
        return array.some((existingItem) => (0, isEqual_1.default)(existingItem, obj));
    }
    // Helper function to validate if an object follows the schema
    function isValidObject(obj, schema) {
        return Object.keys(schema.properties).every((key) => {
            return (obj.hasOwnProperty(key) &&
                typeof obj[key] === schema.properties[key].type);
        });
    }
    // Iterate over each item in the arrayData
    arrayData.forEach((item) => {
        let currentItem = item;
        // Skip null items
        if (currentItem === null) {
            return;
        }
        arrayKeyParts.forEach((part) => {
            if (currentItem && currentItem[part]) {
                currentItem = currentItem[part];
            }
            else {
                currentItem = null;
            }
        });
        // Skip if we couldn't find the nested path
        if (currentItem === null) {
            return;
        }
        // Copy non-array properties from the parent object
        for (const key in parentSchema.properties) {
            if (key !== arrayKey &&
                currentItem.hasOwnProperty(key) &&
                !currentLevel.hasOwnProperty(key)) {
                currentLevel[key] = currentItem[key];
            }
        }
        // Ensure that the currentItem[arrayKey] exists and is an array before mapping
        if (currentItem && currentItem[arrayKey] && Array.isArray(currentItem[arrayKey])) {
            currentItem[arrayKey].forEach((subItem) => {
                if (typeof subItem === "object" &&
                    subItem !== null &&
                    isValidObject(subItem, itemSchema)) {
                    // For arrays of objects, add only unique objects
                    const transformedItem = {};
                    let hasValidData = false;
                    for (const key in itemSchema.properties) {
                        if (subItem.hasOwnProperty(key) && subItem[key] !== undefined) {
                            transformedItem[key] = subItem[key];
                            hasValidData = true;
                        }
                    }
                    if (hasValidData &&
                        !isDuplicateObject(currentLevel[arrayKey], transformedItem)) {
                        currentLevel[arrayKey].push(transformedItem);
                    }
                }
            });
        }
        else {
            console.warn(`Expected an array at ${arrayKey}, but found:`, currentItem ? currentItem[arrayKey] : 'undefined');
            // create an array if it doesn't exist
            if (currentLevel[arrayKey] === undefined) {
                currentLevel[arrayKey] = [];
            }
        }
        // Handle merging of array properties
        for (const key in parentSchema.properties) {
            if (parentSchema.properties[key].type === "array" &&
                currentItem &&
                Array.isArray(currentItem[key])) {
                if (!currentLevel[key]) {
                    currentLevel[key] = [];
                }
                currentItem[key].forEach((value) => {
                    if (!currentLevel[key].includes(value) &&
                        !isDuplicateObject(currentLevel[arrayKey], value)) {
                        currentLevel[key].push(value);
                    }
                });
            }
        }
    });
    return transformedResult;
}
//# sourceMappingURL=transform-array-to-obj.js.map