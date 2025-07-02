"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mixSchemaObjects_F0 = mixSchemaObjects_F0;
async function mixSchemaObjects_F0(finalSchema, singleAnswerResult, multiEntityResult, logger) {
    const finalResult = {};
    logger?.debug("Mixing schema objects.");
    // Recursive helper function to merge results based on schema
    function mergeResults(schema, singleResult, multiResult) {
        const result = {};
        for (const key in schema.properties) {
            if (schema.properties[key].type === "object" &&
                schema.properties[key].properties) {
                // If the property is an object, recursively merge its properties
                result[key] = mergeResults(schema.properties[key], singleResult[key] || {}, multiResult[key] || {});
            }
            else if (schema.properties[key].type === "array" &&
                Array.isArray(multiResult[key])) {
                // If the property is an array, flatten the arrays from multiResult
                result[key] = multiResult[key].flat();
            }
            else if (singleResult.hasOwnProperty(key)) {
                result[key] = singleResult[key];
            }
            else if (multiResult.hasOwnProperty(key)) {
                result[key] = multiResult[key];
            }
        }
        return result;
    }
    // Merge the properties from the final schema
    Object.assign(finalResult, mergeResults(finalSchema, singleAnswerResult, multiEntityResult));
    return finalResult;
}
//# sourceMappingURL=mix-schema-objs-f0.js.map