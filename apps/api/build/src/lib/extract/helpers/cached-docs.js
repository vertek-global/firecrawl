"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedDocs = getCachedDocs;
exports.saveCachedDocs = saveCachedDocs;
const supabase_1 = require("../../../services/supabase");
const canonical_url_1 = require("../../../lib/canonical-url");
async function getCachedDocs(urls, cacheKey) {
    const normalizedUrls = urls.map(canonical_url_1.normalizeUrl);
    const { data, error } = await supabase_1.supabase_service
        .from('cached_scrapes')
        .select('doc')
        .in('url', normalizedUrls)
        .eq('cache_key', cacheKey);
    if (error) {
        console.error('Error fetching cached docs:', error);
        return [];
    }
    const uniqueDocs = new Map();
    data.forEach((res) => {
        const doc = JSON.parse(JSON.stringify(res.doc));
        const docKey = `${doc.metadata.url}-${cacheKey}`;
        if (!uniqueDocs.has(docKey)) {
            uniqueDocs.set(docKey, doc);
        }
    });
    return Array.from(uniqueDocs.values());
}
async function saveCachedDocs(docs, cacheKey) {
    for (const doc of docs) {
        if (!doc.metadata.url) {
            throw new Error("Document has no URL");
        }
        const normalizedUrl = (0, canonical_url_1.normalizeUrl)(doc.metadata.url);
        const { data, error } = await supabase_1.supabase_service
            .from('cached_scrapes')
            .select('url')
            .eq('url', normalizedUrl)
            .eq('cache_key', cacheKey);
        if (error) {
            console.error('Error checking existing cached doc:', error);
            continue;
        }
        if (data.length === 0) {
            const { error: upsertError } = await supabase_1.supabase_service
                .from('cached_scrapes')
                .upsert({
                url: normalizedUrl,
                doc: doc,
                cache_key: cacheKey,
            });
            if (upsertError) {
                console.error('Error saving cached doc:', upsertError);
            }
        }
    }
}
//# sourceMappingURL=cached-docs.js.map