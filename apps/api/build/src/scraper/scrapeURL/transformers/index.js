"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformerStack = void 0;
exports.deriveMetadataFromRawHTML = deriveMetadataFromRawHTML;
exports.deriveHTMLFromRawHTML = deriveHTMLFromRawHTML;
exports.deriveMarkdownFromHTML = deriveMarkdownFromHTML;
exports.deriveLinksFromHTML = deriveLinksFromHTML;
exports.coerceFieldsToFormats = coerceFieldsToFormats;
exports.executeTransformers = executeTransformers;
const html_to_markdown_1 = require("../../../lib/html-to-markdown");
const removeUnwantedElements_1 = require("../lib/removeUnwantedElements");
const extractLinks_1 = require("../lib/extractLinks");
const extractMetadata_1 = require("../lib/extractMetadata");
const llmExtract_1 = require("./llmExtract");
const uploadScreenshot_1 = require("./uploadScreenshot");
const removeBase64Images_1 = require("./removeBase64Images");
const agent_1 = require("./agent");
const diff_1 = require("./diff");
const index_1 = require("../../../services/index");
const index_2 = require("../engines/index/index");
async function deriveMetadataFromRawHTML(meta, document) {
    if (document.rawHtml === undefined) {
        throw new Error("rawHtml is undefined -- this transformer is being called out of order");
    }
    document.metadata = {
        ...(await (0, extractMetadata_1.extractMetadata)(meta, document.rawHtml)),
        ...document.metadata,
    };
    return document;
}
async function deriveHTMLFromRawHTML(meta, document) {
    if (document.rawHtml === undefined) {
        throw new Error("rawHtml is undefined -- this transformer is being called out of order");
    }
    document.html = await (0, removeUnwantedElements_1.htmlTransform)(document.rawHtml, document.metadata.url ?? document.metadata.sourceURL ?? meta.rewrittenUrl ?? meta.url, meta.options);
    return document;
}
async function deriveMarkdownFromHTML(_meta, document) {
    if (document.html === undefined) {
        throw new Error("html is undefined -- this transformer is being called out of order");
    }
    if (document.metadata.contentType?.includes("application/json")) {
        if (document.rawHtml === undefined) {
            throw new Error("rawHtml is undefined -- this transformer is being called out of order");
        }
        document.markdown = "```json\n" + document.rawHtml + "\n```";
        return document;
    }
    document.markdown = await (0, html_to_markdown_1.parseMarkdown)(document.html);
    return document;
}
async function deriveLinksFromHTML(meta, document) {
    // Only derive if the formats has links
    if (meta.options.formats.includes("links")) {
        if (document.html === undefined) {
            throw new Error("html is undefined -- this transformer is being called out of order");
        }
        document.links = await (0, extractLinks_1.extractLinks)(document.html, document.metadata.url ?? document.metadata.sourceURL ?? meta.rewrittenUrl ?? meta.url);
    }
    return document;
}
function coerceFieldsToFormats(meta, document) {
    const formats = new Set(meta.options.formats);
    if (!formats.has("markdown") && document.markdown !== undefined) {
        delete document.markdown;
    }
    else if (formats.has("markdown") && document.markdown === undefined) {
        meta.logger.warn("Request had format: markdown, but there was no markdown field in the result.");
    }
    if (!formats.has("rawHtml") && document.rawHtml !== undefined) {
        delete document.rawHtml;
    }
    else if (formats.has("rawHtml") && document.rawHtml === undefined) {
        meta.logger.warn("Request had format: rawHtml, but there was no rawHtml field in the result.");
    }
    if (!formats.has("html") && document.html !== undefined) {
        delete document.html;
    }
    else if (formats.has("html") && document.html === undefined) {
        meta.logger.warn("Request had format: html, but there was no html field in the result.");
    }
    if (!formats.has("screenshot") &&
        !formats.has("screenshot@fullPage") &&
        document.screenshot !== undefined) {
        meta.logger.warn("Removed screenshot from Document because it wasn't in formats -- this is very wasteful and indicates a bug.");
        delete document.screenshot;
    }
    else if ((formats.has("screenshot") || formats.has("screenshot@fullPage")) &&
        document.screenshot === undefined) {
        meta.logger.warn("Request had format: screenshot / screenshot@fullPage, but there was no screenshot field in the result.");
    }
    if (!formats.has("links") && document.links !== undefined) {
        meta.logger.warn("Removed links from Document because it wasn't in formats -- this is wasteful and indicates a bug.");
        delete document.links;
    }
    else if (formats.has("links") && document.links === undefined) {
        meta.logger.warn("Request had format: links, but there was no links field in the result.");
    }
    if (!formats.has("extract") && (document.extract !== undefined || document.json !== undefined)) {
        meta.logger.warn("Removed extract from Document because it wasn't in formats -- this is extremely wasteful and indicates a bug.");
        delete document.extract;
    }
    else if (formats.has("extract") && document.extract === undefined && document.json === undefined) {
        meta.logger.warn("Request had format extract, but there was no extract field in the result.");
    }
    if (!formats.has("changeTracking") && document.changeTracking !== undefined) {
        meta.logger.warn("Removed changeTracking from Document because it wasn't in formats -- this is extremely wasteful and indicates a bug.");
        delete document.changeTracking;
    }
    else if (formats.has("changeTracking") && document.changeTracking === undefined) {
        meta.logger.warn("Request had format changeTracking, but there was no changeTracking field in the result.");
    }
    if (document.changeTracking &&
        (!meta.options.changeTrackingOptions?.modes?.includes("git-diff")) &&
        document.changeTracking.diff !== undefined) {
        meta.logger.warn("Removed diff from changeTracking because git-diff mode wasn't specified in changeTrackingOptions.modes.");
        delete document.changeTracking.diff;
    }
    if (document.changeTracking &&
        (!meta.options.changeTrackingOptions?.modes?.includes("json")) &&
        document.changeTracking.json !== undefined) {
        meta.logger.warn("Removed structured from changeTracking because structured mode wasn't specified in changeTrackingOptions.modes.");
        delete document.changeTracking.json;
    }
    if (meta.options.actions === undefined || meta.options.actions.length === 0) {
        delete document.actions;
    }
    return document;
}
// TODO: allow some of these to run in parallel
exports.transformerStack = [
    deriveHTMLFromRawHTML,
    deriveMarkdownFromHTML,
    deriveLinksFromHTML,
    deriveMetadataFromRawHTML,
    uploadScreenshot_1.uploadScreenshot,
    ...(index_1.useIndex ? [index_2.sendDocumentToIndex] : []),
    llmExtract_1.performLLMExtract,
    agent_1.performAgent,
    diff_1.deriveDiff,
    coerceFieldsToFormats,
    removeBase64Images_1.removeBase64Images,
];
async function executeTransformers(meta, document) {
    const executions = [];
    for (const transformer of exports.transformerStack) {
        const _meta = {
            ...meta,
            logger: meta.logger.child({
                method: "executeTransformers/" + transformer.name,
            }),
        };
        const start = Date.now();
        document = await transformer(_meta, document);
        executions.push([transformer.name, Date.now() - start]);
    }
    meta.logger.debug("Executed transformers.", { executions });
    return document;
}
//# sourceMappingURL=index.js.map