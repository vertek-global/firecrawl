"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeBase64Images = void 0;
const removeBase64Images = async (markdown) => {
    const regex = /(!\[.*?\])\(data:image\/.*?;base64,.*?\)/g;
    markdown = markdown.replace(regex, "$1(<Base64-Image-Removed>)");
    return markdown;
};
exports.removeBase64Images = removeBase64Images;
//# sourceMappingURL=removeBase64Images.js.map