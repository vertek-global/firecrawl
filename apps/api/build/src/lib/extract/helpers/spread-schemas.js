"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spreadSchemas = spreadSchemas;
async function spreadSchemas(schema, keys) {
    let singleAnswerSchema = { ...schema, properties: { ...schema.properties } };
    let multiEntitySchema = {
        type: "object",
        properties: {},
        ...(schema.required ? { required: [] } : {})
    };
    // Helper function to check if a property path exists in schema
    const hasPropertyPath = (schema, path) => {
        let current = schema.properties;
        for (let i = 0; i < path.length; i++) {
            if (!current[path[i]])
                return false;
            if (current[path[i]].type === "array" && current[path[i]].items) {
                current = current[path[i]].items.properties;
            }
            else {
                current = current[path[i]].properties;
            }
        }
        return true;
    };
    // Helper function to get the root property of a dot path
    const getRootProperty = (path) => {
        return path.split('.')[0];
    };
    keys.forEach((key) => {
        const rootProperty = getRootProperty(key);
        if (singleAnswerSchema.properties[rootProperty]) {
            multiEntitySchema.properties[rootProperty] = singleAnswerSchema.properties[rootProperty];
            delete singleAnswerSchema.properties[rootProperty];
            // Move required field if it exists
            if (schema.required?.includes(rootProperty)) {
                multiEntitySchema.required.push(rootProperty);
                singleAnswerSchema.required = schema.required.filter((k) => k !== rootProperty);
            }
        }
    });
    // Recursively delete empty properties in singleAnswerSchema
    const deleteEmptyProperties = (schema) => {
        for (const key in schema.properties) {
            if (schema.properties[key].properties &&
                Object.keys(schema.properties[key].properties).length === 0) {
                delete schema.properties[key];
            }
            else if (schema.properties[key].properties) {
                deleteEmptyProperties(schema.properties[key]);
            }
        }
    };
    deleteEmptyProperties(singleAnswerSchema);
    deleteEmptyProperties(multiEntitySchema);
    // If singleAnswerSchema has no properties left, return an empty object
    if (Object.keys(singleAnswerSchema.properties).length === 0) {
        singleAnswerSchema = {};
    }
    else if (singleAnswerSchema.required?.length === 0) {
        delete singleAnswerSchema.required;
    }
    if (Object.keys(multiEntitySchema.properties).length === 0) {
        multiEntitySchema = {};
    }
    else if (multiEntitySchema.required?.length === 0) {
        delete multiEntitySchema.required;
    }
    return {
        singleAnswerSchema,
        multiEntitySchema,
    };
}
//# sourceMappingURL=spread-schemas.js.map