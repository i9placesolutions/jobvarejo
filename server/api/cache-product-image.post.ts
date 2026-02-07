import { createSupabaseAdmin } from "../utils/supabase";

// Normaliza termo para cache
const normalizeSearchTerm = (term: string): string => {
    return term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { searchTerm, productName, brand, flavor, weight, imageUrl, s3Key, source } = body;

    if (!searchTerm || !imageUrl) {
        throw createError({ statusCode: 400, statusMessage: "searchTerm and imageUrl required" });
    }

    const normalizedTerm = normalizeSearchTerm(searchTerm);

    try {
        const supabase = createSupabaseAdmin();
        await (supabase.from as any)('product_image_cache').upsert({
            search_term: normalizedTerm,
            product_name: productName || searchTerm,
            brand: brand || null,
            flavor: flavor || null,
            weight: weight || null,
            image_url: imageUrl,
            s3_key: s3Key || null,
            source: source || 'storage',
            usage_count: 1
        }, {
            onConflict: 'search_term',
            ignoreDuplicates: false
        });

        return { success: true };
    } catch (err: any) {
        console.error('Cache save failed:', err);
        throw createError({ statusCode: 500, statusMessage: "Failed to save cache", message: err.message });
    }
});
