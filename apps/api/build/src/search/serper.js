"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serper_search = serper_search;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function serper_search(q, options) {
    let data = JSON.stringify({
        q: q,
        hl: options.lang,
        gl: options.country,
        location: options.location,
        tbs: options.tbs,
        num: options.num_results,
        page: options.page ?? 1,
    });
    let config = {
        method: "POST",
        url: "https://google.serper.dev/search",
        headers: {
            "X-API-KEY": process.env.SERPER_API_KEY,
            "Content-Type": "application/json",
        },
        data: data,
    };
    const response = await (0, axios_1.default)(config);
    if (response && response.data && Array.isArray(response.data.organic)) {
        return response.data.organic.map((a) => ({
            url: a.link,
            title: a.title,
            description: a.snippet,
        }));
    }
    else {
        return [];
    }
}
//# sourceMappingURL=serper.js.map