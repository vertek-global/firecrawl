"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dereferenceSchema_F0 = dereferenceSchema_F0;
const json_schema_ref_parser_1 = require("@apidevtools/json-schema-ref-parser");
async function dereferenceSchema_F0(schema) {
    try {
        return await (0, json_schema_ref_parser_1.dereference)(schema);
    }
    catch (error) {
        console.error("Failed to dereference schema:", error);
        throw error;
    }
}
//# sourceMappingURL=dereference-schema-f0.js.map