"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModel = getModel;
exports.getEmbeddingModel = getEmbeddingModel;
const openai_1 = require("@ai-sdk/openai");
const ollama_ai_provider_1 = require("ollama-ai-provider");
const anthropic_1 = require("@ai-sdk/anthropic");
const groq_1 = require("@ai-sdk/groq");
const google_1 = require("@ai-sdk/google");
const ai_sdk_provider_1 = require("@openrouter/ai-sdk-provider");
const fireworks_1 = require("@ai-sdk/fireworks");
const deepinfra_1 = require("@ai-sdk/deepinfra");
const google_vertex_1 = require("@ai-sdk/google-vertex");
const defaultProvider = process.env.OLLAMA_BASE_URL
    ? "ollama"
    : "openai";
const providerList = {
    openai: (0, openai_1.createOpenAI)({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
    }), //OPENAI_API_KEY
    ollama: (0, ollama_ai_provider_1.createOllama)({
        baseURL: process.env.OLLAMA_BASE_URL,
    }),
    anthropic: anthropic_1.anthropic, //ANTHROPIC_API_KEY
    groq: //ANTHROPIC_API_KEY
    groq_1.groq, //GROQ_API_KEY
    google: //GROQ_API_KEY
    google_1.google, //GOOGLE_GENERATIVE_AI_API_KEY
    openrouter: (0, ai_sdk_provider_1.createOpenRouter)({
        apiKey: process.env.OPENROUTER_API_KEY,
    }),
    fireworks: fireworks_1.fireworks, //FIREWORKS_API_KEY
    deepinfra: //FIREWORKS_API_KEY
    deepinfra_1.deepinfra, //DEEPINFRA_API_KEY
    vertex: (0, google_vertex_1.createVertex)({
        project: "firecrawl",
        //https://github.com/vercel/ai/issues/6644 bug
        baseURL: "https://aiplatform.googleapis.com/v1/projects/firecrawl/locations/global/publishers/google",
        location: "global",
        googleAuthOptions: process.env.VERTEX_CREDENTIALS ? {
            credentials: JSON.parse(atob(process.env.VERTEX_CREDENTIALS)),
        } : {
            keyFile: "./gke-key.json",
        },
    }),
};
function getModel(name, provider = defaultProvider) {
    if (name === "gemini-2.5-pro") {
        name = "gemini-2.5-pro-preview-06-05";
    }
    return process.env.MODEL_NAME
        ? providerList[provider](process.env.MODEL_NAME)
        : providerList[provider](name);
}
function getEmbeddingModel(name, provider = defaultProvider) {
    return process.env.MODEL_EMBEDDING_NAME
        ? providerList[provider].embedding(process.env.MODEL_EMBEDDING_NAME)
        : providerList[provider].embedding(name);
}
//# sourceMappingURL=generic-ai.js.map