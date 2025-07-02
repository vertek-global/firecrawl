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
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMock = saveMock;
exports.loadMock = loadMock;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const logger_1 = require("../../../lib/logger");
const saveMocksDirPath = path.join(__dirname, "../mocks/").replace("dist/", "");
const loadMocksDirPath = path.join(__dirname, "../../../__tests__/snips/mocks").replace("dist/", "");
async function saveMock(options, result) {
    if (process.env.FIRECRAWL_SAVE_MOCKS !== "true")
        return;
    await fs.mkdir(saveMocksDirPath, { recursive: true });
    const fileName = Date.now() + "-" + crypto.randomUUID() + ".json";
    const filePath = path.join(saveMocksDirPath, fileName);
    console.log(filePath);
    await fs.writeFile(filePath, JSON.stringify({
        time: Date.now(),
        options,
        result,
    }, undefined, 4));
}
async function loadMock(name, logger = logger_1.logger) {
    try {
        const mockPath = path.join(loadMocksDirPath, name + ".json");
        const relative = path.relative(loadMocksDirPath, mockPath);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
            // directory moving
            return null;
        }
        const load = JSON.parse(await fs.readFile(mockPath, "utf8"));
        return {
            requests: load,
            tracker: {},
        };
    }
    catch (error) {
        logger.warn("Failed to load mock file!", {
            name,
            module: "scrapeURL:mock",
            method: "loadMock",
            error,
        });
        return null;
    }
}
//# sourceMappingURL=mock.js.map