"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMarkdown = parseMarkdown;
const koffi_1 = __importDefault(require("koffi"));
const path_1 = require("path");
require("../services/sentry");
const Sentry = __importStar(require("@sentry/node"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./logger");
const promises_1 = require("fs/promises");
dotenv_1.default.config();
// TODO: add a timeout to the Go parser
const goExecutablePath = (0, path_1.join)(process.cwd(), "sharedLibs", "go-html-to-md", "html-to-markdown.so");
class GoMarkdownConverter {
    static instance;
    convert;
    constructor() {
        const lib = koffi_1.default.load(goExecutablePath);
        this.convert = lib.func("ConvertHTMLToMarkdown", "string", ["string"]);
    }
    static async getInstance() {
        if (!GoMarkdownConverter.instance) {
            try {
                await (0, promises_1.stat)(goExecutablePath);
            }
            catch (_) {
                throw Error("Go shared library not found");
            }
            GoMarkdownConverter.instance = new GoMarkdownConverter();
        }
        return GoMarkdownConverter.instance;
    }
    async convertHTMLToMarkdown(html) {
        return new Promise((resolve, reject) => {
            this.convert.async(html, (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(res);
                }
            });
        });
    }
}
async function parseMarkdown(html) {
    if (!html) {
        return "";
    }
    try {
        if (process.env.USE_GO_MARKDOWN_PARSER == "true") {
            const converter = await GoMarkdownConverter.getInstance();
            let markdownContent = await converter.convertHTMLToMarkdown(html);
            markdownContent = processMultiLineLinks(markdownContent);
            markdownContent = removeSkipToContentLinks(markdownContent);
            // logger.info(`HTML to Markdown conversion using Go parser successful`);
            return markdownContent;
        }
    }
    catch (error) {
        if (!(error instanceof Error) ||
            error.message !== "Go shared library not found") {
            Sentry.captureException(error);
            logger_1.logger.error(`Error converting HTML to Markdown with Go parser: ${error}`);
        }
        else {
            logger_1.logger.warn("Tried to use Go parser, but it doesn't exist in the file system.", { goExecutablePath });
        }
    }
    // Fallback to TurndownService if Go parser fails or is not enabled
    var TurndownService = require("turndown");
    var turndownPluginGfm = require("joplin-turndown-plugin-gfm");
    const turndownService = new TurndownService();
    turndownService.addRule("inlineLink", {
        filter: function (node, options) {
            return (options.linkStyle === "inlined" &&
                node.nodeName === "A" &&
                node.getAttribute("href"));
        },
        replacement: function (content, node) {
            var href = node.getAttribute("href").trim();
            var title = node.title ? ' "' + node.title + '"' : "";
            return "[" + content.trim() + "](" + href + title + ")\n";
        },
    });
    var gfm = turndownPluginGfm.gfm;
    turndownService.use(gfm);
    try {
        let markdownContent = await turndownService.turndown(html);
        markdownContent = processMultiLineLinks(markdownContent);
        markdownContent = removeSkipToContentLinks(markdownContent);
        return markdownContent;
    }
    catch (error) {
        logger_1.logger.error("Error converting HTML to Markdown", { error });
        return ""; // Optionally return an empty string or handle the error as needed
    }
}
function processMultiLineLinks(markdownContent) {
    let insideLinkContent = false;
    let newMarkdownContent = "";
    let linkOpenCount = 0;
    for (let i = 0; i < markdownContent.length; i++) {
        const char = markdownContent[i];
        if (char == "[") {
            linkOpenCount++;
        }
        else if (char == "]") {
            linkOpenCount = Math.max(0, linkOpenCount - 1);
        }
        insideLinkContent = linkOpenCount > 0;
        if (insideLinkContent && char == "\n") {
            newMarkdownContent += "\\" + "\n";
        }
        else {
            newMarkdownContent += char;
        }
    }
    return newMarkdownContent;
}
function removeSkipToContentLinks(markdownContent) {
    // Remove [Skip to Content](#page) and [Skip to content](#skip)
    const newMarkdownContent = markdownContent.replace(/\[Skip to Content\]\(#[^\)]*\)/gi, "");
    return newMarkdownContent;
}
//# sourceMappingURL=html-to-markdown.js.map