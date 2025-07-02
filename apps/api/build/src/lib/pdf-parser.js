"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPageCount = getPageCount;
const koffi_1 = __importDefault(require("koffi"));
const path_1 = require("path");
const promises_1 = require("fs/promises");
const os_1 = require("os");
// TODO: add a timeout to the Rust parser
const rustExecutablePath = (0, path_1.join)(process.cwd(), "sharedLibs/pdf-parser/target/release/", (0, os_1.platform)() === "darwin" ? "libpdf_parser.dylib" : "libpdf_parser.so");
class RustPDFParser {
    static instance;
    _getPageCount;
    constructor() {
        const lib = koffi_1.default.load(rustExecutablePath);
        this._getPageCount = lib.func("get_page_count", "int32", ["string"]);
    }
    static async isParserAvailable() {
        if (RustPDFParser.instance) {
            return true;
        }
        try {
            await (0, promises_1.stat)(rustExecutablePath);
            RustPDFParser.instance = new RustPDFParser();
            return true;
        }
        catch (_) {
            return false;
        }
    }
    static async getInstance() {
        if (!RustPDFParser.instance) {
            try {
                await (0, promises_1.stat)(rustExecutablePath);
            }
            catch (_) {
                throw Error("Rust pdf-parser shared library not found");
            }
            RustPDFParser.instance = new RustPDFParser();
        }
        return RustPDFParser.instance;
    }
    async getPageCount(path) {
        return new Promise((resolve, reject) => {
            this._getPageCount.async(path, (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    if (res === -1) {
                        reject(new Error("Failed to parse PDF."));
                    }
                    else {
                        resolve(res);
                    }
                }
            });
        });
    }
}
async function getPageCount(path) {
    const converter = await RustPDFParser.getInstance();
    return await converter.getPageCount(path);
}
//# sourceMappingURL=pdf-parser.js.map