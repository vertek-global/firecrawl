"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLinks = extractLinks;
exports.extractMetadata = extractMetadata;
exports.transformHtml = transformHtml;
exports.getInnerJSON = getInnerJSON;
const koffi_1 = __importDefault(require("koffi"));
const path_1 = require("path");
const promises_1 = require("fs/promises");
const os_1 = require("os");
// TODO: add a timeout to the Rust transformer
const rustExecutablePath = (0, path_1.join)(process.cwd(), "sharedLibs/html-transformer/target/release/", (0, os_1.platform)() === "darwin" ? "libhtml_transformer.dylib" : "libhtml_transformer.so");
class RustHTMLTransformer {
    static instance;
    _extractLinks;
    _extractMetadata;
    _transformHtml;
    _freeString;
    _getInnerJSON;
    constructor() {
        const lib = koffi_1.default.load(rustExecutablePath);
        this._freeString = lib.func("free_string", "void", ["string"]);
        const cstn = "CString:" + crypto.randomUUID();
        const freedResultString = koffi_1.default.disposable(cstn, "string", this._freeString);
        this._extractLinks = lib.func("extract_links", freedResultString, ["string"]);
        this._extractMetadata = lib.func("extract_metadata", freedResultString, ["string"]);
        this._transformHtml = lib.func("transform_html", freedResultString, ["string"]);
        this._getInnerJSON = lib.func("get_inner_json", freedResultString, ["string"]);
    }
    static async getInstance() {
        if (!RustHTMLTransformer.instance) {
            try {
                await (0, promises_1.stat)(rustExecutablePath);
            }
            catch (_) {
                throw Error("Rust html-transformer shared library not found");
            }
            RustHTMLTransformer.instance = new RustHTMLTransformer();
        }
        return RustHTMLTransformer.instance;
    }
    async extractLinks(html) {
        return new Promise((resolve, reject) => {
            this._extractLinks.async(html, (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(JSON.parse(res));
                }
            });
        });
    }
    async extractMetadata(html) {
        return new Promise((resolve, reject) => {
            this._extractMetadata.async(html, (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(JSON.parse(res));
                }
            });
        });
    }
    async transformHtml(opts) {
        return new Promise((resolve, reject) => {
            this._transformHtml.async(JSON.stringify(opts), (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    if (res === "RUSTFC:ERROR") {
                        reject(new Error("Something went wrong on the Rust side."));
                    }
                    else {
                        resolve(res);
                    }
                }
            });
        });
    }
    async getInnerJSON(html) {
        return new Promise((resolve, reject) => {
            this._getInnerJSON.async(html, (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    if (res === "RUSTFC:ERROR") {
                        reject(new Error("Something went wrong on the Rust side."));
                    }
                    else {
                        resolve(res);
                    }
                }
            });
        });
    }
}
async function extractLinks(html) {
    if (!html) {
        return [];
    }
    const converter = await RustHTMLTransformer.getInstance();
    return await converter.extractLinks(html);
}
async function extractMetadata(html) {
    if (!html) {
        return [];
    }
    const converter = await RustHTMLTransformer.getInstance();
    return await converter.extractMetadata(html);
}
async function transformHtml(opts) {
    const converter = await RustHTMLTransformer.getInstance();
    return await converter.transformHtml(opts);
}
async function getInnerJSON(html) {
    const converter = await RustHTMLTransformer.getInstance();
    return await converter.getInnerJSON(html);
}
//# sourceMappingURL=html-transformer.js.map