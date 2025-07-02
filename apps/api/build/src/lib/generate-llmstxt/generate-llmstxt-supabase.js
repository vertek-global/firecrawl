"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLlmsTextFromCache = getLlmsTextFromCache;
exports.saveLlmsTextToCache = saveLlmsTextToCache;
const supabase_1 = require("../../services/supabase");
const logger_1 = require("../logger");
const canonical_url_1 = require("../canonical-url");
async function getLlmsTextFromCache(url, maxUrls) {
    if (process.env.USE_DB_AUTHENTICATION !== "true") {
        return null;
    }
    const originUrl = (0, canonical_url_1.normalizeUrlOnlyHostname)(url);
    try {
        const { data, error } = await supabase_1.supabase_service
            .from("llm_texts")
            .select("*")
            .eq("origin_url", originUrl)
            .gte("max_urls", maxUrls) // Changed to gte since we want cached results with more URLs than requested
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
        if (error) {
            return null;
        }
        // Check if data is older than 1 week
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        if (!data || new Date(data.updated_at) < oneWeekAgo) {
            return null;
        }
        return data;
    }
    catch (error) {
        logger_1.logger.error("Failed to fetch LLMs text from cache", { error, originUrl });
        return null;
    }
}
async function saveLlmsTextToCache(url, llmstxt, llmstxt_full, maxUrls) {
    if (process.env.USE_DB_AUTHENTICATION !== "true") {
        return;
    }
    const originUrl = (0, canonical_url_1.normalizeUrlOnlyHostname)(url);
    try {
        // First check if there's an existing entry
        const { data: existingData } = await supabase_1.supabase_service
            .from("llm_texts")
            .select("*")
            .eq("origin_url", originUrl)
            .single();
        if (existingData) {
            // Update existing entry
            const { error } = await supabase_1.supabase_service
                .from("llm_texts")
                .update({
                llmstxt,
                llmstxt_full,
                max_urls: maxUrls,
                updated_at: new Date().toISOString(),
            })
                .eq("origin_url", originUrl);
            if (error) {
                logger_1.logger.error("Error updating LLMs text in cache", { error, originUrl });
            }
            else {
                logger_1.logger.debug("Successfully updated cached LLMs text", { originUrl, maxUrls });
            }
        }
        else {
            // Insert new entry
            const { error } = await supabase_1.supabase_service
                .from("llm_texts")
                .insert({
                origin_url: originUrl,
                llmstxt,
                llmstxt_full,
                max_urls: maxUrls,
                updated_at: new Date().toISOString(),
            });
            if (error) {
                logger_1.logger.error("Error inserting LLMs text to cache", { error, originUrl });
            }
            else {
                logger_1.logger.debug("Successfully inserted new cached LLMs text", { originUrl, maxUrls });
            }
        }
    }
    catch (error) {
        logger_1.logger.error("Failed to save LLMs text to cache", { error, originUrl });
    }
}
//# sourceMappingURL=generate-llmstxt-supabase.js.map