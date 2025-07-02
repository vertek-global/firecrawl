"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchResult = exports.Document = void 0;
class Document {
    id;
    url; // Used only in /search for now
    content;
    markdown;
    html;
    rawHtml;
    llm_extraction;
    createdAt;
    updatedAt;
    type;
    metadata;
    childrenLinks;
    provider;
    warning;
    actions;
    index;
    linksOnPage; // Add this new field as a separate property
    constructor(data) {
        if (!data.content) {
            throw new Error("Missing required fields");
        }
        this.content = data.content;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.type = data.type || "unknown";
        this.metadata = data.metadata || { sourceURL: "" };
        this.markdown = data.markdown || "";
        this.childrenLinks = data.childrenLinks || undefined;
        this.provider = data.provider || undefined;
        this.linksOnPage = data.linksOnPage; // Assign linksOnPage if provided
    }
}
exports.Document = Document;
class SearchResult {
    url;
    title;
    description;
    constructor(url, title, description) {
        this.url = url;
        this.title = title;
        this.description = description;
    }
    toString() {
        return `SearchResult(url=${this.url}, title=${this.title}, description=${this.description})`;
    }
}
exports.SearchResult = SearchResult;
//# sourceMappingURL=entities.js.map