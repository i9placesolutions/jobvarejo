import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { saveProductImageCache } from "../utils/product-image-cache";

// Normalização avançada de cache key (espelha process-product-image.post.ts)
const UNIT_MAP: Record<string, string> = {
    mililitros: 'ml', mililitro: 'ml', mls: 'ml',
    gramas: 'g', grama: 'g', gram: 'g', gr: 'g', grs: 'g', gs: 'g',
    quilos: 'kg', quilo: 'kg', quilogramas: 'kg', quilograma: 'kg', kgs: 'kg',
    unidades: 'un', unidade: 'un', und: 'un', unds: 'un', uns: 'un',
    litro: 'l', litros: 'l', lt: 'l', lts: 'l', litr: 'l', litrs: 'l',
    pacote: 'pct', pacotes: 'pct', pcts: 'pct',
    caixa: 'cx', caixas: 'cx',
    fardo: 'fd', fardos: 'fd',
};
const STOP_WORDS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'com', 'em', 'e', 'para', 'por', 'no', 'na']);

const normalizeSearchTerm = (term: string): string => {
    const words = term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/(\d)[,](\d)/g, '$1.$2')
        .replace(/[^a-z0-9.\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(w => !STOP_WORDS.has(w) && w.length > 0)
        .map(w => UNIT_MAP[w] || w);
    return [...new Set(words)].sort().join(' ');
};

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `cache-product-image:${user.id}`, 120, 60_000)
    const body = await readBody(event);
    const payload = (body && typeof body === 'object') ? body as Record<string, any> : null
    const searchTerm = String(payload?.searchTerm || '').trim()
    const productName = String(payload?.productName || '').trim()
    const brand = String(payload?.brand || '').trim()
    const flavor = String(payload?.flavor || '').trim()
    const weight = String(payload?.weight || '').trim()
    const imageUrl = String(payload?.imageUrl || '').trim()
    const s3Key = String(payload?.s3Key || '').trim()
    const source = String(payload?.source || 'storage').trim()

    if (!searchTerm || !imageUrl) {
        throw createError({ statusCode: 400, statusMessage: "searchTerm and imageUrl required" });
    }
    if (searchTerm.length > 160) {
        throw createError({ statusCode: 400, statusMessage: 'searchTerm too long (max 160 chars)' })
    }
    if (imageUrl.length > 2048) {
        throw createError({ statusCode: 400, statusMessage: 'imageUrl too long' })
    }
    if (productName.length > 180 || brand.length > 120 || flavor.length > 120 || weight.length > 60) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid payload length' })
    }

    const normalizedTerm = normalizeSearchTerm(searchTerm);
    if (!normalizedTerm) {
        throw createError({ statusCode: 400, statusMessage: 'searchTerm is invalid after normalization' })
    }

    try {
        const ok = await saveProductImageCache({
            searchTerm: normalizedTerm,
            productName: productName || searchTerm,
            brand: brand || undefined,
            flavor: flavor || undefined,
            weight: weight || undefined,
            imageUrl,
            s3Key: s3Key || undefined,
            source: source || 'storage',
            userId: user.id
        });
        if (!ok) {
            throw new Error('Failed to save cache item')
        }

        return { success: true };
    } catch (err: any) {
        console.error('Cache save failed:', err);
        throw createError({ statusCode: 500, statusMessage: "Failed to save cache: " + (err?.message || String(err)) });
    }
});
