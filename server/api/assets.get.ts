import { getS3Client } from "../utils/s3";
import { getCachedS3Objects } from "../utils/s3-object-cache";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { pgQuery } from "../utils/postgres";
import { normalizeSearchTerm } from "../utils/product-image-matching";

type AssetItem = {
    id: string;
    key?: string | null;
    name: string;
    url: string;
    source: 's3' | 'cache';
    size?: number;
    lastModified?: Date | string | null;
    score?: number;
};

type CacheRow = {
    id?: string | number;
    search_term?: string | null;
    product_name?: string | null;
    brand?: string | null;
    flavor?: string | null;
    weight?: string | null;
    image_url?: string | null;
    s3_key?: string | null;
    source?: string | null;
    usage_count?: number | null;
};

let openaiInstance: any = null;
const aiVariantsMemo = new Map<string, { expiresAt: number; variants: string[] }>();
const getOpenAI = async () => {
    if (!openaiInstance) {
        const { default: OpenAI } = await import("openai");
        const config = useRuntimeConfig();
        openaiInstance = new OpenAI({ apiKey: config.openaiApiKey || "" });
    }
    return openaiInstance;
};

const normalizeText = (value: string) =>
    String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/(\d)[,](\d)/g, "$1.$2")
        .replace(/[^a-z0-9.\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const toProxyUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`;

const resolveWasabiKeyFromUrl = (rawUrl: string, bucketName: string, endpoint: string): string | null => {
    const value = String(rawUrl || "").trim();
    if (!value) return null;

    const directKeyPrefixes = ["imagens/", "uploads/", "logo/", "projects/"];
    if (directKeyPrefixes.some((prefix) => value.startsWith(prefix))) return value;

    if (/^[^/]+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(value)) {
        return value;
    }

    if (value.startsWith("/api/storage/proxy?") || value.startsWith("/api/storage/p?")) {
        try {
            const parsed = new URL(value, "http://local");
            const key = parsed.searchParams.get("key");
            return key ? decodeURIComponent(key) : null;
        } catch {
            return null;
        }
    }

    if (!(value.startsWith("http://") || value.startsWith("https://"))) return null;
    try {
        const parsed = new URL(value);
        const host = parsed.host.toLowerCase();
        const pathParts = decodeURIComponent(parsed.pathname || "").split("/").filter(Boolean);

        const hostLooksLikeStorage =
            (endpoint && host.includes(endpoint)) ||
            host.includes("wasabisys.com");
        if (!hostLooksLikeStorage || pathParts.length === 0) return null;

        // Path-style: https://endpoint/bucket/key...
        if (pathParts[0] === bucketName && pathParts.length > 1) {
            return pathParts.slice(1).join("/");
        }
        // Virtual-host-style: https://bucket.endpoint/key...
        if (bucketName && host.startsWith(`${bucketName}.`) && pathParts.length > 0) {
            return pathParts.join("/");
        }
        // Fallback: path já parece ser uma key completa
        if (directKeyPrefixes.some((prefix) => pathParts[0]?.startsWith(prefix.replace("/", "")))) {
            return pathParts.join("/");
        }
    } catch {
        return null;
    }

    return null;
};

const tokenize = (text: string): string[] =>
    normalizeText(text)
        .split(" ")
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => t.length > 1);

const uniqueStrings = (items: string[]) => [...new Set(items.map((i) => String(i || "").trim()).filter(Boolean))];

const WEIGHT_TOKEN_RE = /^\d+(?:\.\d+)?(?:kg|g|mg|ml|l|un)$/
const VARIANT_GROUP_TOKENS = new Set(['zero', 'diet', 'light'])

const extractWeightTokensFromNormalized = (normalized: string): string[] => {
    const out = new Set<string>()
    for (const t of String(normalized || '').split(' ').filter(Boolean)) {
        const token = String(t).trim().toLowerCase()
        if (WEIGHT_TOKEN_RE.test(token)) out.add(token)
    }
    return [...out].sort()
}

const isVariantAndWeightCompatible = (queryNormalized: string, targetNormalized: string): boolean => {
    const qSet = new Set(String(queryNormalized || '').split(' ').filter(Boolean))
    const tSet = new Set(String(targetNormalized || '').split(' ').filter(Boolean))

    const queryNeedsZero = [...VARIANT_GROUP_TOKENS].some((t) => qSet.has(t))
    const targetHasZero = [...VARIANT_GROUP_TOKENS].some((t) => tSet.has(t))
    if (queryNeedsZero && !targetHasZero) return false

    const queryOriginal = qSet.has('original')
    if (queryOriginal && targetHasZero) return false

    const qWeights = extractWeightTokensFromNormalized(queryNormalized)
    const tWeights = extractWeightTokensFromNormalized(targetNormalized)
    if (qWeights.length > 0 && tWeights.length === 0) return false
    if (qWeights.length > 0 && tWeights.length > 0 && qWeights.join('|') !== tWeights.join('|')) return false

    return true
}

const buildSearchTextFromAsset = (asset: AssetItem): string =>
    normalizeText(`${asset.name || ""} ${asset.key || ""} ${asset.source || ""}`);

const buildSearchTextFromCache = (row: CacheRow): string =>
    normalizeText(
        `${row.search_term || ""} ${row.product_name || ""} ${row.brand || ""} ${row.flavor || ""} ${row.weight || ""} ${row.s3_key || ""}`
    );

const scoreByTokens = (targetText: string, queryVariants: string[]) => {
    if (!targetText) return 0;
    const targetNormalized = normalizeSearchTerm(targetText)
    let best = 0;
    for (const variant of queryVariants) {
        const q = normalizeText(variant);
        if (!q) continue;
        const qNormalized = normalizeSearchTerm(variant)
        if (!isVariantAndWeightCompatible(qNormalized, targetNormalized)) {
            continue;
        }
        const qTokens = tokenize(q);
        if (!qTokens.length) continue;

        const tTokens = new Set(tokenize(targetText));
        let overlap = 0;
        for (const token of qTokens) if (tTokens.has(token)) overlap++;

        const ratio = overlap / qTokens.length;
        const hasPhrase = targetText.includes(q) ? 1 : 0;
        const score = ratio * 100 + hasPhrase * 25 + overlap * 3;
        if (score > best) best = score;
    }
    return best;
};

const extractDisplayNameFromKey = (key: string): string => {
    const rawName = key.split("/").pop()?.replace(/^\d+-/, "") || key;
    const baseName = rawName.replace(/\.[^/.]+$/, "");
    try {
        return decodeURIComponent(baseName);
    } catch {
        return baseName;
    }
};

const expandSearchVariantsWithAI = async (opts: {
    query: string;
    productName?: string;
    brand?: string;
    flavor?: string;
    weight?: string;
    maxVariants?: number;
}): Promise<string[]> => {
    const config = useRuntimeConfig();
    if (!config.openaiApiKey) return [];

    const query = String(opts.query || "").trim();
    if (!query) return [];
    const memoKey = normalizeText(`${query} ${opts.productName || ''} ${opts.brand || ''} ${opts.flavor || ''} ${opts.weight || ''}`);
    const cached = aiVariantsMemo.get(memoKey);
    if (cached && cached.expiresAt > Date.now()) return cached.variants;

    try {
        const openai = await getOpenAI();
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            max_tokens: 220,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content:
                        "Você expande buscas de imagens de produtos de supermercado brasileiro. Responda somente JSON: {\"variants\":[\"...\"]}. Gere variações curtas com marca, tipo, gramatura e sinônimos úteis de embalagem. Sem frases longas."
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        query,
                        productName: opts.productName || "",
                        brand: opts.brand || "",
                        flavor: opts.flavor || "",
                        weight: opts.weight || "",
                        goal: "Buscar imagens de embalagem real do produto no banco interno."
                    })
                }
            ]
        });

        const content = String(response?.choices?.[0]?.message?.content || "").trim();
        if (!content) return [];
        const parsed = JSON.parse(content);
        const variants = Array.isArray(parsed?.variants) ? parsed.variants : [];
        const maxVariants = Math.min(16, Math.max(3, Number(opts.maxVariants || 10)));
        const out = uniqueStrings(variants.map((v: any) => String(v || ""))).slice(0, maxVariants);
        aiVariantsMemo.set(memoKey, { expiresAt: Date.now() + 120_000, variants: out });
        if (aiVariantsMemo.size > 2000) aiVariantsMemo.clear();
        return out;
    } catch (err: any) {
        console.warn("⚠️ [Assets][AI Expand] Falha:", err?.message || err);
        return [];
    }
};

const buildHeuristicVariants = (opts: {
    query: string;
    productName?: string;
    brand?: string;
    flavor?: string;
    weight?: string;
}): string[] => {
    const out: string[] = [];
    const q = String(opts.query || "").trim();
    const name = String(opts.productName || "").trim();
    const brand = String(opts.brand || "").trim();
    const flavor = String(opts.flavor || "").trim();
    const weight = String(opts.weight || "").trim();

    if (q) out.push(q);
    if (name) out.push(name);
    if (brand && q) out.push(`${brand} ${q}`);
    if (weight && q) out.push(`${q} ${weight}`);
    if (flavor && q) out.push(`${q} ${flavor}`);
    if (brand && name) out.push(`${brand} ${name}`);
    if (weight && name) out.push(`${name} ${weight}`);

    const baseCombined = [q, name, brand, flavor, weight].filter(Boolean).join(' ').toLowerCase()
    if (/\brefri\b/.test(baseCombined) || /\brefrigerante\b/.test(baseCombined)) {
        out.push('refrigerante')
    }
    if (/\bcoca[\s-]*cola\b/.test(baseCombined) || /\bcoca\b/.test(baseCombined)) {
        out.push('cocacola')
    }
    if (/\btradicional\b/.test(baseCombined) || /\bclassico\b/.test(baseCombined) || /\bclassic\b/.test(baseCombined)) {
        out.push('original')
    }
    if (/\bzero\b/.test(baseCombined) || /\bsem acucar\b/.test(baseCombined) || /\bzero acucar\b/.test(baseCombined)) {
        out.push('zero')
    }

    const baseTokens = tokenize([q, name].filter(Boolean).join(" "));
    if (baseTokens.length >= 2) {
        out.push(baseTokens.slice(0, 2).join(" "));
        out.push(baseTokens.slice(0, 3).join(" "));
    }

    return uniqueStrings(out);
};

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `assets-list:${user.id}`, 120, 60_000)
    const config = useRuntimeConfig();
    const bucketName = String(config.wasabiBucket || "");
    const endpoint = String(config.wasabiEndpoint || "").toLowerCase();
    const query = getQuery(event);
    const source = typeof query.source === "string" ? query.source.trim().toLowerCase() : "";
    const uploadsOnlyMode = source === "uploads";
    const disableAiExpand =
        uploadsOnlyMode ||
        String(query.ai ?? "").toLowerCase() === "0" ||
        String(query.expand ?? "").toLowerCase() === "0";
    const skipCacheRows =
        uploadsOnlyMode ||
        String(query.includeCache ?? "").toLowerCase() === "0";

    const rawSearch = typeof query.q === "string" ? query.q.trim() : "";
    if (rawSearch.length > 120) {
        throw createError({ statusCode: 400, statusMessage: "Search query too long (max 120 chars)" })
    }
    const searchMode = rawSearch.length >= 1;
    const productName = typeof query.productName === "string" ? query.productName.trim() : "";
    const brand = typeof query.brand === "string" ? query.brand.trim() : "";
    const flavor = typeof query.flavor === "string" ? query.flavor.trim() : "";
    const weight = typeof query.weight === "string" ? query.weight.trim() : "";
    if (productName.length > 120 || brand.length > 80 || flavor.length > 80 || weight.length > 40) {
        throw createError({ statusCode: 400, statusMessage: "Invalid filter length" })
    }

    const wantsPaginated =
        String(query.paginated ?? "").toLowerCase() === "1" ||
        String(query.paginated ?? "").toLowerCase() === "true" ||
        typeof query.cursor === "string";
    const forceFresh =
        String(query.fresh ?? "").toLowerCase() === "1" ||
        String(query.fresh ?? "").toLowerCase() === "true";
    const hasExplicitLimit = query.limit !== undefined;
    const requestedLimit = Number(query.limit ?? 120);
    const resultLimit = Number.isFinite(requestedLimit)
        ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
        : 120;
    const requestedCursor = Number(query.cursor ?? 0);
    const startIndex = Number.isFinite(requestedCursor) ? Math.max(0, Math.floor(requestedCursor)) : 0;

    try {
        const heuristicVariants = buildHeuristicVariants({
            query: rawSearch,
            productName,
            brand,
            flavor,
            weight
        });
        const aiVariants = (searchMode && !disableAiExpand)
            ? await expandSearchVariantsWithAI({
                query: rawSearch,
                productName,
                brand,
                flavor,
                weight,
                maxVariants: 10
            })
            : [];
        const queryVariants = uniqueStrings([...heuristicVariants, ...aiVariants]).slice(0, 24);
        const hasVariants = queryVariants.length > 0;
        const rawSearchNormalized = normalizeText(rawSearch);

        const assetNameByKey = new Map<string, string>();
        if (uploadsOnlyMode) {
            try {
                const { rows } = await pgQuery<{ asset_key: string; display_name: string }>(
                    `select asset_key, display_name
                     from public.asset_names
                     where user_id = $1`,
                    [user.id]
                );
                for (const row of rows || []) {
                    const key = String(row?.asset_key || "").trim();
                    const displayName = String(row?.display_name || "").trim();
                    if (!key || !displayName) continue;
                    assetNameByKey.set(key, displayName);
                }
            } catch {
                // asset_names table may not exist; ignore to keep search resilient.
            }
        }

        const [s3Items, cacheRows] = await Promise.all([
            (async () => {
                if (!bucketName) return [] as AssetItem[];
                const s3 = getS3Client();
                const listedObjects = await getCachedS3Objects({
                    s3,
                    bucket: bucketName,
                    prefixes: ["imagens/", "uploads/"],
                    ttlMs: 90_000,
                    maxKeysPerPrefix: uploadsOnlyMode ? 12_000 : (hasVariants ? 10_000 : 1_500),
                    excludeKeyPrefixes: ["imagens/bg-removed-"],
                    forceRefresh: forceFresh
                });
                const mapped: AssetItem[] = listedObjects.map((item) => ({
                    id: `s3:${item.key}`,
                    key: item.key,
                    name: assetNameByKey.get(item.key) || extractDisplayNameFromKey(item.key),
                    url: toProxyUrl(item.key),
                    source: "s3" as const,
                    size: item.size,
                    lastModified: item.lastModified || null,
                    score: 0
                }));
                if (!hasVariants) return mapped;
                return mapped
                    .map((asset) => {
                        const text = buildSearchTextFromAsset(asset);
                        const tokenScore = scoreByTokens(text, queryVariants);
                        const substringBoost =
                            rawSearchNormalized && text.includes(rawSearchNormalized) ? 80 : 0;
                        return { ...asset, score: tokenScore + substringBoost };
                    })
                    .filter((asset) => Number(asset.score || 0) > 0);
            })(),
            (async () => {
                if (skipCacheRows) return [] as CacheRow[];
                try {
                    const { rows } = await pgQuery<CacheRow>(
                        `select id, search_term, product_name, brand, flavor, weight, image_url, s3_key, source, usage_count
                         from public.product_image_cache
                         where image_url is not null
                         order by usage_count desc nulls last
                         limit $1`,
                        [hasVariants ? 1400 : 600]
                    );
                    return Array.isArray(rows) ? rows : [] as CacheRow[];
                } catch {
                    return [] as CacheRow[];
                }
            })()
        ]);

        const cacheItems: AssetItem[] = [];
        for (const row of cacheRows) {
            const imageUrlRaw = String(row.image_url || "").trim();
            const resolvedKey =
                String(row.s3_key || "").trim() ||
                resolveWasabiKeyFromUrl(imageUrlRaw, bucketName, endpoint) ||
                "";
            const resolvedUrl = resolvedKey ? toProxyUrl(resolvedKey) : imageUrlRaw;
            if (!resolvedUrl) continue;
            const displayName =
                String(row.product_name || "").trim() ||
                String(row.search_term || "").trim() ||
                resolvedKey ||
                "Imagem de produto";
            const item: AssetItem = {
                id: `cache:${row.id || resolvedKey || row.image_url}`,
                key: resolvedKey || null,
                name: displayName,
                url: resolvedUrl,
                source: "cache",
                lastModified: null,
                score: hasVariants ? scoreByTokens(buildSearchTextFromCache(row), queryVariants) + Math.min(25, Number(row.usage_count || 0)) : 0
            };
            if (hasVariants && Number(item.score || 0) <= 0) continue;
            cacheItems.push(item);
        }

        const dedupMap = new Map<string, AssetItem>();
        const allItems = [...cacheItems, ...s3Items];
        for (const item of allItems) {
            const dedupKey = String(item.key || item.url || item.id);
            const existing = dedupMap.get(dedupKey);
            if (!existing) {
                dedupMap.set(dedupKey, item);
                continue;
            }
            const existingScore = Number(existing.score || 0);
            const nextScore = Number(item.score || 0);
            if (nextScore > existingScore) dedupMap.set(dedupKey, item);
        }

        const merged = Array.from(dedupMap.values());
        merged.sort((a, b) => {
            const sa = Number(a.score || 0);
            const sb = Number(b.score || 0);
            if (sb !== sa) return sb - sa;
            const da = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const db = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return db - da;
        });

        const mapToPayload = (item: AssetItem) => ({
            id: item.id,
            key: item.key || null,
            name: item.name,
            url: item.url,
            source: item.source,
            score: item.score || 0,
            size: item.size,
            lastModified: item.lastModified || null
        });

        if (wantsPaginated) {
            const endIndex = Math.min(merged.length, startIndex + resultLimit);
            const page = merged.slice(startIndex, endIndex);
            const nextCursor = endIndex < merged.length ? String(endIndex) : null;
            return {
                items: page.map(mapToPayload),
                nextCursor,
                hasMore: nextCursor !== null,
                total: merged.length,
                queryVariants
            };
        }

        const shouldApplyLimit = searchMode || hasExplicitLimit;
        const finalItems = shouldApplyLimit ? merged.slice(0, resultLimit) : merged;
        return finalItems.map(mapToPayload);
    } catch (error: any) {
        console.error("Assets smart search error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list assets: " + (error?.message || String(error)) });
    }
});
