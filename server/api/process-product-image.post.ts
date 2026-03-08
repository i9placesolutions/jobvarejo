import { getS3Client, getPublicUrl } from "../utils/s3";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { validateProductImageCandidatesWithAI } from "../utils/product-image-ai";
import { searchSerperImageCandidates } from "../utils/product-image-serper";
import {
    findProductImageCacheHitByTerms,
    incrementProductImageCacheUsage,
    saveProductImageCache
} from "../utils/product-image-cache";
import {
    buildDeterministicS3Key,
    buildExpandedNormalizedCandidates,
    findBestS3Match,
    hasWeightInNormalized,
    normalizeSearchTerm
} from "../utils/product-image-matching";
import {
    ensureBgRemoved,
    runExternalPipelineOnce,
    s3KeyExists,
    type BgPolicy
} from "../utils/product-image-pipeline";
import {
    buildProductIdentityKey,
    findRegistryApprovedImage,
    upsertProductImageRegistry
} from "../utils/product-image-registry";
import { resolveStorageReadUrl } from "../utils/project-storage-refs";

type ExternalCandidate = {
    url: string;
    title?: string;
    source?: string;
    domain?: string;
    imageWidth?: number;
    imageHeight?: number;
    score?: number;
}

const tokenizeNormalized = (value: string, minLen = 3): string[] =>
    normalizeSearchTerm(value)
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => token.length >= minLen);

const WEIGHT_TOKEN_RE = /^\d+(?:\.\d+)?(?:kg|g|mg|ml|l|un|pct|cx|fd)$/i;
const MULTIPACK_WEIGHT_TOKEN_RE = /^\d+x\d+(?:\.\d+)?(?:kg|g|mg|ml|l|un|pct|cx|fd)$/i;
const GENERIC_FLAVOR_TOKENS = new Set([
    'sabor', 'sabores', 'sortido', 'sortidos', 'variado', 'variados', 'diverso', 'diversos'
]);
const VARIANT_CONFLICT_TOKENS = new Set([
    'zero', 'diet', 'light', 'original', 'tradicional', 'classico',
    'limao', 'laranja', 'uva', 'morango', 'manga', 'abacaxi', 'guarana',
    'coco', 'chocolate', 'baunilha', 'cafe', 'caramelo', 'menta'
]);

const extractWeightTokens = (value: string): string[] =>
    tokenizeNormalized(value, 1)
        .filter((token) => WEIGHT_TOKEN_RE.test(token) || MULTIPACK_WEIGHT_TOKEN_RE.test(token))
        .filter((token, idx, arr) => arr.indexOf(token) === idx);

const hasTokenIntersection = (a: string[], bSet: Set<string>): boolean => {
    for (const token of a) {
        if (bSet.has(token)) return true;
    }
    return false;
};

const BAD_HINT_REGEX = /(logo|vetor|vector|icone|icon|clipart|mockup|banner|wallpaper|papel parede|sticker|figura|figurinha|svg|eps|psd)/i;

const passesMetadataHardGate = (opts: {
    title?: string;
    source?: string;
    domain?: string;
    url?: string;
    term: string;
    brand?: string;
    flavor?: string;
    weight?: string;
}): boolean => {
    const haystackRaw = [opts.title, opts.source, opts.domain, opts.url].filter(Boolean).join(' ');
    const haystackNormalized = normalizeSearchTerm(haystackRaw);
    const haystackTokenSet = new Set(haystackNormalized.split(' ').filter(Boolean));
    if (haystackTokenSet.size === 0) return false;

    const brandTokens = tokenizeNormalized(String(opts.brand || ''), 2);
    if (brandTokens.length > 0 && !hasTokenIntersection(brandTokens, haystackTokenSet)) return false;

    const flavorTokens = tokenizeNormalized(String(opts.flavor || ''))
        .filter((token) => !GENERIC_FLAVOR_TOKENS.has(token));
    if (flavorTokens.length > 0 && !hasTokenIntersection(flavorTokens, haystackTokenSet)) {
        const hasConflictingVariantHint = Array.from(haystackTokenSet).some(
            (token) => VARIANT_CONFLICT_TOKENS.has(token)
        );
        if (hasConflictingVariantHint) return false;
    }

    const expectedWeightTokens = extractWeightTokens(String(opts.weight || ''));
    if (expectedWeightTokens.length > 0) {
        const candidateWeightTokens = new Set(extractWeightTokens(haystackRaw));
        if (candidateWeightTokens.size > 0 && !expectedWeightTokens.some((token) => candidateWeightTokens.has(token))) {
            return false;
        }
    }

    const termTokens = tokenizeNormalized(opts.term).filter((token) => token.length >= 3);
    if (termTokens.length === 0) return true;
    let hits = 0;
    for (const t of termTokens) {
        if (haystackTokenSet.has(t)) hits++;
    }
    const requiredHits = termTokens.length >= 5
        ? Math.ceil(termTokens.length * 0.5)
        : Math.max(1, Math.ceil(termTokens.length * 0.45));
    if (hits < requiredHits) return false;

    if (BAD_HINT_REGEX.test(haystackRaw) && hits < Math.max(2, requiredHits)) return false;
    return true;
};

const buildExternalQueryVariants = (opts: {
    primarySearchInput: string;
    searchQuery: string;
    term: string;
    brand?: string;
    weight?: string;
    flavor?: string;
}): string[] => {
    const unique = new Set<string>();
    const push = (value: string) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        unique.add(text);
    };

    push(opts.searchQuery);
    push(opts.primarySearchInput);
    push(opts.term);
    push([opts.brand, opts.term, opts.weight].filter(Boolean).join(' '));

    const termTokens = String(opts.term || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (termTokens.length >= 3) {
        push(termTokens.slice(0, -1).join(' '));
    }
    if (termTokens.length >= 2) {
        push(termTokens.slice(0, 2).join(' '));
    }
    if (opts.brand && termTokens.length >= 2) {
        push([opts.brand, termTokens[0], termTokens[1]].join(' '));
    }
    if (opts.flavor) {
        push([opts.term, opts.flavor].filter(Boolean).join(' '));
    }

    return Array.from(unique).slice(0, 6);
};

const buildSerperQueryVariants = (opts: {
    baseVariants: string[];
    term: string;
    brand?: string;
    weight?: string;
    productCode?: string;
}): string[] => {
    const queries = new Set<string>();
    const push = (value: string) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        queries.add(text);
    };
    const negatives = '-logo -vetor -vector -icone -icon -clipart -mockup -banner -wallpaper';

    for (const base of opts.baseVariants.slice(0, 5)) {
        push(`"${base}" embalagem produto ${negatives}`);
        push(`"${base}" embalagem frente ${negatives}`);
        push(`"${base}" foto produto supermercado ${negatives}`);
        if (opts.weight) push(`"${base}" ${opts.weight} embalagem ${negatives}`);
    }

    push(`${opts.term} embalagem original ${negatives}`);
    push([opts.brand, opts.term, 'embalagem', negatives].filter(Boolean).join(' '));
    if (opts.productCode && /^\d{8,14}$/.test(opts.productCode)) {
        push(`"${opts.productCode}" ${opts.term} embalagem ${negatives}`);
    }

    return Array.from(queries).slice(0, 10);
};

const rankExternalCandidatesByMetadata = (
    list: ExternalCandidate[],
    opts: { term: string; brand?: string; flavor?: string; weight?: string }
): ExternalCandidate[] => {
    const tokenizedTerm = tokenizeNormalized(opts.term).filter((token) => token.length >= 3);
    const termTokenSet = [...new Set(tokenizedTerm)];
    const brandTokens = tokenizeNormalized(String(opts.brand || ''), 2);
    const flavorTokens = tokenizeNormalized(String(opts.flavor || ''))
        .filter((token) => !GENERIC_FLAVOR_TOKENS.has(token));
    const weightTokens = extractWeightTokens(String(opts.weight || ''));
    const badDomainRegex = /(pinterest|pinimg|freepik|wikimedia|wikipedia|shutterstock|depositphotos|istockphoto|vectorstock)/i;

    return [...list]
        .map((entry) => {
            const haystackRaw = [entry.title, entry.source, entry.domain, entry.url].filter(Boolean).join(' ');
            const haystackNormalized = normalizeSearchTerm(haystackRaw);
            const haystackTokenSet = new Set(haystackNormalized.split(' ').filter(Boolean));
            const haystackWeightSet = new Set(extractWeightTokens(haystackRaw));
            let score = Number(entry.score || 0);

            for (const token of termTokenSet) {
                if (haystackTokenSet.has(token)) score += 2.1;
            }
            if (brandTokens.length > 0) {
                score += hasTokenIntersection(brandTokens, haystackTokenSet) ? 14 : -12;
            }
            if (flavorTokens.length > 0) {
                score += hasTokenIntersection(flavorTokens, haystackTokenSet) ? 6 : -3.5;
            }
            if (weightTokens.length > 0) {
                if (haystackWeightSet.size === 0) score -= 1.5;
                else score += weightTokens.some((token) => haystackWeightSet.has(token)) ? 9 : -12;
            }
            if (BAD_HINT_REGEX.test(haystackRaw)) score -= 9;
            if (badDomainRegex.test(String(entry.domain || entry.source || ''))) score -= 4;

            const width = Number(entry.imageWidth || 0);
            const height = Number(entry.imageHeight || 0);
            if (width > 0 && height > 0) {
                const minSide = Math.min(width, height);
                if (minSide >= 280) score += 2;
                else if (minSide < 120) score -= 4;
            }

            return { entry, score };
        })
        .filter((item) => item.score > -12)
        .sort((a, b) => b.score - a.score)
        .map((item) => ({ ...item.entry, score: Number(item.score.toFixed(3)) }));
};

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default defineEventHandler(async (event) => {
    try {
        const user = await requireAuthenticatedUser(event);
        enforceRateLimit(event, `process-product-image:${user.id}`, 30, 60_000);

        const body = await readBody(event);
        const term = String(body?.term || '').trim();
        const rawSearchHints: unknown[] = Array.isArray(body?.searchHints) ? body.searchHints : [];
        const searchHints = rawSearchHints
            .map((entry: unknown) => String(entry || '').trim())
            .filter(Boolean)
            .slice(0, 8);
        const brand = String(body?.brand || '').trim() || undefined;
        const flavor = String(body?.flavor || '').trim() || undefined;
        const weight = String(body?.weight || '').trim() || undefined;
        const productCode = String(body?.productCode || '').trim() || undefined;
    const matchMode = String(body?.matchMode || '').toLowerCase() === 'fast' ? 'fast' : 'precise';
    const strictMode = matchMode === 'precise' ? true : !!body?.strictMode;
        const allowExternal = body?.allowExternal === undefined ? true : !!body?.allowExternal;
        const rawBgPolicy = String(body?.bgPolicy || '').trim().toLowerCase();
        const bgPolicy: BgPolicy =
            rawBgPolicy === 'always' || rawBgPolicy === 'never' || rawBgPolicy === 'auto'
                ? (rawBgPolicy as BgPolicy)
                : 'auto';

        if (!term) {
            throw createError({ statusCode: 400, statusMessage: "Search term required" });
        }
        if (term.length > 180) {
            throw createError({ statusCode: 400, statusMessage: "Search term too long (max 180 chars)" });
        }
        if (searchHints.some((hint) => hint.length > 180)) {
            throw createError({ statusCode: 400, statusMessage: "searchHints item too long (max 180 chars each)" });
        }
        if ((brand && brand.length > 120) || (flavor && flavor.length > 120) || (weight && weight.length > 60) || (productCode && productCode.length > 64)) {
            throw createError({ statusCode: 400, statusMessage: "Invalid metadata length" });
        }

        const config = useRuntimeConfig();
        const s3 = getS3Client();
        const bucketName = config.wasabiBucket;
        const wasabiEndpoint = String(
            config.wasabiEndpoint ||
            config.public?.wasabiEndpoint ||
            config.public?.wasabi?.endpoint ||
            ''
        ).trim();

        // Build an explicit "most complete" term: name + metadata + gramatura.
        const combinedFullTerm = [term, brand, flavor, weight]
            .filter(Boolean)
            .join(' ')
            .trim();

        const normalizedInputPool = [...new Set([
            combinedFullTerm,
            ...searchHints,
            term,
            [brand, term].filter(Boolean).join(' '),
            [term, flavor].filter(Boolean).join(' '),
            [term, weight].filter(Boolean).join(' '),
            [brand, term, flavor, weight].filter(Boolean).join(' ')
        ].map((item) => String(item || '').trim().slice(0, 220)).filter(Boolean))];

        const primarySearchInput = normalizedInputPool[0] || term;
        const normalizedTerm = normalizeSearchTerm(primarySearchInput);
        const deterministicKey = buildDeterministicS3Key(normalizedTerm);
        const enforceWeight = hasWeightInNormalized(normalizedTerm);
        const candidateNormalizedTerms = buildExpandedNormalizedCandidates({
            rawInputs: normalizedInputPool,
            enforceWeight,
            maxCandidates: 12
        });
        if (!candidateNormalizedTerms.includes(normalizedTerm)) {
            candidateNormalizedTerms.unshift(normalizedTerm);
        }
        const candidateKeys = [...new Set(candidateNormalizedTerms.map(buildDeterministicS3Key))];
        const noImageResponse = (reason: string, details: Record<string, any> = {}) => {
            const reasonText = String(reason || '').trim();
            const fallbackNextAction = (() => {
                if (!strictMode) return undefined;
                if (reasonText.includes('external_search_config_missing') || reasonText.includes('external_search_disabled')) {
                    return 'Ative a busca externa nas configurações e reprocessar, ou aplique imagem manualmente.';
                }
                if (reasonText.includes('openai_validation_missing') || reasonText.includes('ai_validation_failed')) {
                    return 'Adicione EAN/código ou termos de peso/variante e reprocesse em modo preciso.';
                }
                if (reasonText.includes('no_candidates') || reasonText.includes('metadata_gate_rejected')) {
                    return 'Tente ajustar o termo principal (marca + peso) e reprocesse, ou use imagem manual.';
                }
                if (reasonText.includes('processing_failed')) {
                    return 'Reprocessar com política de busca rápida ou fazer upload manual em seguida.';
                }
                return 'Revise manualmente e escolha outra fonte de imagem.';
            })();

            const provider = details?.provider || 'external';
            const source = String(details?.provider || 'external');
            const candidateCount = Number(details?.candidateCount || candidateNormalizedTerms.length || 0);
            const attempts = Number(details?.attempts || 0);
            const confidence = Number.isFinite(Number(details?.confidence))
                ? Math.max(0, Math.min(1, Number(details.confidence)))
                : 0;

            return {
                found: false,
                url: null,
                source,
                reason: reasonText,
                provider: source,
                candidateCount: candidateCount,
                attempts,
                confidence,
                reviewPending: strictMode,
                reviewReason: String(details?.reviewReason || reasonText || ''),
                imageReviewReason: String(details?.imageReviewReason || reasonText || ''),
                nextAction: String(details?.nextAction || fallbackNextAction || ''),
                ...(details || {})
            };
        };
        const identityKey = buildProductIdentityKey({
            productCode,
            normalizedTerm,
            brand,
            flavor,
            weight
        });
        const safeUpsertRegistry = async (args: Parameters<typeof upsertProductImageRegistry>[0]) => {
            try {
                await upsertProductImageRegistry(args);
            } catch (registryErr: any) {
                console.warn('⚠️ [Registry] Falha ao persistir registro:', registryErr?.message || String(registryErr));
            }
        };

        if (!String(bucketName || '').trim()) {
            console.warn('⚠️ [process-product-image] wasabiBucket ausente no runtime config.');
            return noImageResponse('wasabi_bucket_missing', { missingConfig: ['wasabiBucket'] });
        }

        console.log(`🔍 [Search] Termo: "${primarySearchInput}" → Normalizado: "${normalizedTerm}" → Key: "${deterministicKey}"`);
        if (candidateNormalizedTerms.length > 1) {
            console.log(`🧭 [Search Variants] ${candidateNormalizedTerms.length} variantes:`, candidateNormalizedTerms.slice(0, 8));
        }

    // ========================================
    // -1. REGISTRY DETERMÍNISTICO (productCode/meta identity)
    // ========================================
    try {
        const registryHit = await findRegistryApprovedImage(identityKey);
        const registryKey = String(registryHit?.s3_key || '').trim();
        if (registryKey) {
            const exists = await s3KeyExists(s3, bucketName, registryKey);
            if (exists) {
                console.log(`✅ [Registry] Match aprovado por identityKey: "${identityKey}"`);
                return {
                    source: 'registry',
                    url: await resolveStorageReadUrl(registryKey, user.id),
                    key: registryKey,
                    provider: 'registry',
                    confidence: 1,
                    candidateCount: 0,
                    attempts: 0,
                    reviewPending: false
                };
            }
        }
    } catch (err: any) {
        console.warn('⚠️ [Registry] Falha ao buscar match aprovado:', err?.message || String(err));
    }

    // ========================================
    // 0. GUARD: S3 key determinístico já existe?
    // ========================================
    for (const candidateKey of candidateKeys) {
        const keyAlreadyExists = await s3KeyExists(s3, bucketName, candidateKey);
        if (!keyAlreadyExists) continue;

        console.log(`✅ [S3 Head] Key já existe: "${candidateKey}" — pulando pipeline`);
        
        // Salvar no cache DB (pode ter falhado antes)
        await saveProductImageCache({
            searchTerm: normalizedTerm,
            productName: term,
            brand, flavor, weight,
            imageUrl: getPublicUrl(candidateKey),
            s3Key: candidateKey,
            source: 'internal'
        });
        await safeUpsertRegistry({
            productCode,
            identityKey,
            canonicalName: term,
            brand,
            flavor,
            weight,
            s3Key: candidateKey,
            source: 'internal',
            validationLevel: 'deterministic-s3',
            validatedBy: user.id,
            status: 'approved'
        });

        return {
            source: 'cache-s3',
            url: await resolveStorageReadUrl(candidateKey, user.id),
            key: candidateKey,
            provider: 'internal',
            confidence: 0.99,
            candidateCount: 0,
            attempts: 0,
            reviewPending: false
        };
    }

    // ========================================
    // 1. INTERNAL SEARCH (Wasabi S3) - consulta uploads/ e imagens/ antes de cache DB/Google
    // ========================================
    try {
        const found = await findBestS3Match({
            s3,
            bucketName,
            prefixes: ['uploads/', 'imagens/'],
            normalizedCandidates: candidateNormalizedTerms,
            brand,
            flavor,
            weight,
            productCode,
            strictOnly: strictMode
        });

        if (found) {
            if (bgPolicy === 'always') {
                const processed = await ensureBgRemoved({
                    s3, bucketName,
                    sourceKey: found,
                    deterministicKey,
                    normalizedTerm, term, brand, flavor, weight
                });
                if (processed) {
                    await safeUpsertRegistry({
                        productCode,
                        identityKey,
                        canonicalName: term,
                        brand,
                        flavor,
                        weight,
                        s3Key: processed.key,
                        source: processed.processed ? 'internal-processed' : 'internal',
                        validationLevel: 'bucket-strict',
                        validatedBy: user.id,
                        status: 'approved'
                    });
                        return {
                            source: processed.processed ? 'internal-processed' : 'internal',
                            url: await resolveStorageReadUrl(processed.key, user.id),
                            key: processed.key,
                            provider: 'internal',
                            confidence: 0.99,
                            candidateCount: 1,
                            attempts: 1,
                            reviewPending: false
                        };
                    }
                }

            await saveProductImageCache({
                searchTerm: normalizedTerm,
                productName: term,
                brand, flavor, weight,
                imageUrl: getPublicUrl(found),
                s3Key: found,
                source: bgPolicy === 'always' ? 'internal-fallback' : 'internal'
            });
            await safeUpsertRegistry({
                productCode,
                identityKey,
                canonicalName: term,
                brand,
                flavor,
                weight,
                s3Key: found,
                source: 'internal',
                validationLevel: 'bucket-strict',
                validatedBy: user.id,
                status: 'approved'
            });

            return {
                source: 'internal',
                url: await resolveStorageReadUrl(found, user.id),
                key: found,
                provider: 'internal',
                confidence: 0.93,
                candidateCount: 1,
                attempts: 1,
                reviewPending: false
            };
        }
    } catch (err) {
        console.warn("Internal search failed:", err);
    }

    // ========================================
    // 1.5 CACHE DATABASE (Supabase) - fallback exato com s3_key
    // ========================================
    try {
        const cacheHit = await findProductImageCacheHitByTerms(candidateNormalizedTerms, {
            bucketName: String(bucketName || '').trim(),
            endpoint: wasabiEndpoint
        });
        const cacheResolvedKey = String(cacheHit?.resolved_s3_key || cacheHit?.s3_key || '').trim();

        if (cacheResolvedKey) {
            const exists = await s3KeyExists(s3, bucketName, cacheResolvedKey);
            if (!exists) {
                console.warn(`⚠️ [Cache DB] s3_key inexistente, ignorando cache: ${cacheResolvedKey}`);
            } else {
                console.log(`✅ [Cache DB] Hit exato para "${term}" (source: ${cacheHit?.source || 'unknown'})`);
                // Incrementar usage_count (fire-and-forget — OK para counter)
                void incrementProductImageCacheUsage(cacheHit?.id);

                if (bgPolicy === 'always') {
                    const processed = await ensureBgRemoved({
                        s3, bucketName,
                        sourceKey: cacheResolvedKey,
                        deterministicKey,
                        normalizedTerm, term, brand, flavor, weight
                    });
                    if (processed) {
                        await safeUpsertRegistry({
                            productCode,
                            identityKey,
                            canonicalName: term,
                            brand,
                            flavor,
                            weight,
                            s3Key: processed.key,
                            source: 'cache-processed',
                            validationLevel: 'cache-s3-verified',
                            validatedBy: user.id,
                            status: 'approved'
                        });
                        return {
                            source: 'cache-processed',
                            url: await resolveStorageReadUrl(processed.key, user.id),
                            key: processed.key,
                            provider: 'cache',
                            confidence: 0.95,
                            candidateCount: 1,
                            attempts: 1,
                            reviewPending: false
                        };
                    }
                }
                await safeUpsertRegistry({
                    productCode,
                    identityKey,
                    canonicalName: term,
                    brand,
                    flavor,
                    weight,
                    s3Key: cacheResolvedKey,
                    source: 'cache',
                    validationLevel: 'cache-s3-verified',
                    validatedBy: user.id,
                    status: 'approved'
                });
                return {
                    source: 'cache',
                    url: await resolveStorageReadUrl(cacheResolvedKey, user.id),
                    key: cacheResolvedKey,
                    provider: 'cache',
                    confidence: 0.88,
                    candidateCount: 1,
                    attempts: 1,
                    reviewPending: false
                };
            }
        }
    } catch (err) {
        console.warn("⚠️ [Cache DB] Falha na consulta:", (err as any)?.message);
    }

    // Construir query otimizada (mais específica = menos false positives).
    const searchQueryParts: string[] = [primarySearchInput];
    const querySeedLower = String(primarySearchInput).toLowerCase();
    if (brand && !querySeedLower.includes(String(brand).toLowerCase())) searchQueryParts.push(brand);
    if (weight && !querySeedLower.includes(String(weight).toLowerCase())) searchQueryParts.push(weight);
    if (flavor && !['sabores', 'fragrâncias', 'fragancias', 'variados', 'sortidos', 'diversos'].includes(String(flavor).toLowerCase())) {
        if (!querySeedLower.includes(String(flavor).toLowerCase())) searchQueryParts.push(flavor);
    }
    const searchQuery = searchQueryParts.filter(Boolean).join(' ').trim();

    const hasSerper = !!config.serperApiKey;
    if (!allowExternal) {
        await safeUpsertRegistry({
            productCode,
            identityKey,
            canonicalName: term,
            brand,
            flavor,
            weight,
            source: 'external-disabled',
            validationLevel: 'none',
            validatedBy: user.id,
            status: 'review_pending',
            reason: 'external_disabled'
        });
        return noImageResponse('external_search_disabled', {
            provider: 'external-disabled',
            candidateCount: candidateNormalizedTerms.length,
            attempts: 0,
            confidence: 0,
            nextAction: 'Ative a busca externa nas configurações e reprocesse em seguida.',
            reviewPending: true
        });
    }

    if (!hasSerper) {
        console.warn('⚠️ [process-product-image] Provider Serper não configurado.');
        await safeUpsertRegistry({
            productCode,
            identityKey,
            canonicalName: term,
            brand,
            flavor,
            weight,
            source: 'external',
            validationLevel: 'none',
            validatedBy: user.id,
            status: 'review_pending',
            reason: 'external_provider_missing'
        });
        return noImageResponse('external_search_config_missing', {
            provider: 'external',
            candidateCount: candidateNormalizedTerms.length,
            attempts: 0,
            confidence: 0,
            missingConfig: ['serperApiKey'],
            nextAction: 'Configure Serper e execute novamente em modo preciso, ou use busca manual.'
        });
    }

    let candidates: ExternalCandidate[] = [];
    let providerUsed: 'serper' | null = null;
    let lastProviderError: Record<string, any> | null = null;
    const externalQueryVariants = buildExternalQueryVariants({
        primarySearchInput,
        searchQuery,
        term,
        brand,
        weight,
        flavor
    });
    const serperQueryVariants = buildSerperQueryVariants({
        baseVariants: externalQueryVariants,
        term,
        brand,
        weight,
        productCode
    });

    if (candidates.length === 0 && hasSerper) {
        const collected = new Map<string, ExternalCandidate>();
        let successfulQueries = 0;
        for (const q of serperQueryVariants) {
            const serperResult = await searchSerperImageCandidates({
                apiKey: config.serperApiKey,
                query: q,
                gl: 'br',
                hl: 'pt-br',
                num: 15,
                maxCandidates: 8,
                timeoutMs: 10_000
            });
            if (serperResult.error) {
                lastProviderError = { provider: 'serper', query: q, ...serperResult.error };
                console.warn(`⚠️ [Serper] erro (${serperResult.error.kind}) para query="${q}".`);
                continue;
            }
            if (serperResult.candidates.length > 0) {
                providerUsed = 'serper';
                successfulQueries += 1;
                for (const candidate of serperResult.candidates) {
                    const key = String(candidate?.url || '').trim();
                    if (!key) continue;
                    const existing = collected.get(key);
                    if (!existing) {
                        collected.set(key, candidate);
                        continue;
                    }
                    const existingScore = Number(existing.score || 0);
                    const nextScore = Number(candidate.score || 0);
                    if (nextScore > existingScore) {
                        collected.set(key, candidate);
                    } else {
                        existing.score = Number((existingScore + 0.6).toFixed(3));
                        collected.set(key, existing);
                    }
                }
                console.log(`✅ [Serper] ${serperResult.candidates.length} candidatas em query="${q}" (acumulado=${collected.size})`);
                if (collected.size >= 8 || (collected.size >= 5 && successfulQueries >= 2)) break;
            }
        }
        candidates = Array.from(collected.values());
    }

    if (candidates.length > 1) {
        candidates = rankExternalCandidatesByMetadata(candidates, { term, brand, flavor, weight }).slice(0, 8);
    }

    if (candidates.length === 0) {
        await safeUpsertRegistry({
            productCode,
            identityKey,
            canonicalName: term,
            brand,
            flavor,
            weight,
            source: providerUsed || 'external',
            validationLevel: 'search-no-candidates',
            validatedBy: user.id,
            status: 'review_pending',
            reason: 'no_candidates'
        });
        return noImageResponse(`No image found for "${term}"`, {
            provider: providerUsed || lastProviderError?.provider || 'none',
            candidateCount: 0,
            attempts: 0,
            confidence: 0,
            externalError: lastProviderError || undefined
        });
    }

    const gatedCandidates = candidates.filter((entry) => passesMetadataHardGate({
        title: entry.title,
        source: entry.source,
        domain: entry.domain,
        url: entry.url,
        term,
        brand,
        flavor,
        weight
    }));
    if (gatedCandidates.length > 0) {
        candidates = gatedCandidates;
    }
    if (candidates.length === 0) {
        await safeUpsertRegistry({
            productCode,
            identityKey,
            canonicalName: term,
            brand,
            flavor,
            weight,
            source: providerUsed || 'external',
            validationLevel: 'hard-gate-rejected',
            validatedBy: user.id,
            status: 'review_pending',
            reason: 'metadata_gate_rejected'
        });
            return noImageResponse(`No reliable image found for "${term}"`, {
            provider: providerUsed || 'none',
            reason: 'metadata_gate_rejected',
            candidateCount: 0,
            attempts: 0,
            confidence: 0,
            imageReviewReason: 'Metadata rejeitou as melhores candidatas. Refaça o termo com marca e peso.'
        });
    }

    // ========================================
    // 2.5 VALIDAÇÃO IA: GPT-4o Vision escolhe a melhor imagem
    // ========================================
    let selectedImageUrl = '';
    let selectedImageConfidence = 0;
    let validationLevelForRegistry = 'ocr+ai-strict';
    if (!config.openaiApiKey) {
        if (strictMode) {
            await safeUpsertRegistry({
                productCode,
                identityKey,
                canonicalName: term,
                brand,
                flavor,
                weight,
                source: providerUsed || 'external',
                validationLevel: 'none',
                validatedBy: user.id,
                status: 'review_pending',
                reason: 'openai_validation_missing'
            });
            return noImageResponse(`No reliable image found for "${term}"`, {
                reason: 'openai_validation_missing',
                provider: providerUsed || 'external',
                candidateCount: candidates.length,
                attempts: 0,
                confidence: 0,
                imageReviewReason: 'OpenAI não disponível para validação em modo preciso.',
                nextAction: 'Cadastre a chave OpenAI nas configurações e reprocesse.'
            });
        }

        selectedImageUrl = String(candidates[0]?.url || '').trim();
        selectedImageConfidence = 0.3;
        validationLevelForRegistry = 'ocr+fallback-no-openai';
        console.warn('⚠️ [AI] OpenAI ausente e strictMode=false, usando fallback da 1a candidata externa.');
    } else {
        try {
            const validation = await validateProductImageCandidatesWithAI(candidates, {
                name: term,
                brand: brand || undefined,
                flavor: flavor || undefined,
                weight: weight || undefined,
                productCode: productCode || undefined,
                normalizedQuery: normalizedTerm
            });

            const confidenceThreshold = strictMode ? 0.9 : 0.75;
            const requiresExactMatch = strictMode;
            const bestIndexValid = validation.bestIndex >= 0 && validation.bestIndex < candidates.length;
            if (!bestIndexValid || validation.confidence < confidenceThreshold || (requiresExactMatch && !validation.isExactMatch)) {
                if (strictMode) {
                    await safeUpsertRegistry({
                        productCode,
                        identityKey,
                        canonicalName: term,
                        brand,
                        flavor,
                        weight,
                        source: providerUsed || 'external',
                        validationLevel: 'ai-strict',
                        validatedBy: user.id,
                        status: 'review_pending',
                        reason: [
                            `confidence=${validation.confidence.toFixed(2)}`,
                            `isExact=${validation.isExactMatch}`,
                            `strictMode=${strictMode}`,
                            ...validation.mismatchReasons
                        ].join('; ')
                    });
                    return noImageResponse(`No reliable image found for "${term}"`, {
                        aiConfidence: validation.confidence,
                        aiBestIndex: validation.bestIndex,
                        aiExactMatch: validation.isExactMatch,
                        aiMismatchReasons: validation.mismatchReasons,
                        provider: providerUsed || 'external',
                        candidateCount: candidates.length,
                        attempts: 0,
                        confidence: Math.max(0, Math.min(1, validation.confidence)),
                        imageReviewReason: [
                            `Confiança AI ${(validation.confidence * 100).toFixed(0)}% abaixo do mínimo (${(confidenceThreshold * 100).toFixed(0)}%).`,
                            ...validation.mismatchReasons
                        ].filter(Boolean).join(' ')
                    });
                }

                const fallbackIndex = bestIndexValid ? validation.bestIndex : 0;
                selectedImageUrl = String(candidates[fallbackIndex]?.url || candidates[0]?.url || '').trim();
                selectedImageConfidence = Math.max(0.4, validation.confidence);
                validationLevelForRegistry = 'ocr+fallback-ai-low-confidence';
                console.warn(
                    `⚠️ [AI] Validação inconclusiva (confidence=${validation.confidence.toFixed(2)}, exact=${validation.isExactMatch})` +
                    ' com strictMode=false, usando fallback externo.'
                );
            } else {
                selectedImageUrl = candidates[validation.bestIndex]!.url;
                selectedImageConfidence = validation.confidence;
                console.log(
                    `🎯 [AI] Selecionada imagem ${validation.bestIndex + 1}/${candidates.length} com ${(validation.confidence * 100).toFixed(0)}% confiança` +
                    ` (isExact=${validation.isExactMatch}, strictMode=${strictMode})`
                );
            }
        } catch (err) {
            console.warn('⚠️ [AI] Validação estrita falhou:', (err as any)?.message);
            if (strictMode) {
                await safeUpsertRegistry({
                    productCode,
                    identityKey,
                    canonicalName: term,
                    brand,
                    flavor,
                    weight,
                    source: providerUsed || 'external',
                    validationLevel: 'ai-strict',
                    validatedBy: user.id,
                    status: 'review_pending',
                    reason: 'ai_validation_failed'
                });
                return noImageResponse(`No reliable image found for "${term}"`, {
                    reason: 'ai_validation_failed',
                    provider: providerUsed || 'external',
                    candidateCount: candidates.length,
                    attempts: 0,
                    confidence: 0,
                    imageReviewReason: 'Falha crítica na validação por IA. Refaça com modo rápido ou ajuste o termo.',
                    nextAction: 'Inclua EAN/código e tente novamente no modo preciso.'
                });
            }

            selectedImageUrl = String(candidates[0]?.url || '').trim();
            selectedImageConfidence = 0.25;
            validationLevelForRegistry = 'ocr+fallback-ai-error';
        }
    }

    // ========================================
    // 3. PROCESS + UPLOAD PIPELINE (S3 key determinístico)
    // ========================================
        const fallbackUrls = candidates
            .map((c) => String(c?.url || '').trim())
            .filter(Boolean)
            .filter((url, idx, arr) => arr.indexOf(url) === idx)
            .filter((url) => url !== selectedImageUrl)
            .slice(0, 3);
        const pipelineTryUrls = [selectedImageUrl, ...fallbackUrls].filter(Boolean);
        let pipelineLastErr: any = null;
        let attempts = 0;

        for (const candidateUrl of pipelineTryUrls) {
            try {
                attempts += 1;
                const pipelineResult = await runExternalPipelineOnce({
                    s3,
                    bucketName,
                    deterministicKey,
                    normalizedTerm,
                    term,
                    brand,
                    flavor,
                    weight,
                    selectedImageUrl: candidateUrl,
                    bgPolicy
                });
                const resolvedKey = String(pipelineResult?.key || deterministicKey).trim() || deterministicKey;
                await safeUpsertRegistry({
                    productCode,
                    identityKey,
                    canonicalName: term,
                    brand,
                    flavor,
                    weight,
                    s3Key: resolvedKey,
                    source: providerUsed || 'external',
                    validationLevel: validationLevelForRegistry,
                    validatedBy: user.id,
                    status: 'approved'
                });
                return {
                    ...pipelineResult,
                    confidence: Math.max(0, Math.min(1, selectedImageConfidence)),
                    provider: providerUsed || 'external',
                    candidateCount: candidates.length,
                    attempts,
                    imageReviewReason: `matched-by:${validationLevelForRegistry}`,
                    reviewPending: false,
                    url: await resolveStorageReadUrl(pipelineResult?.key || pipelineResult?.url, user.id)
                };
            } catch (err: any) {
                pipelineLastErr = err;
                console.warn(`⚠️ [Pipeline] Falhou para candidata ${candidateUrl.slice(0, 120)}:`, err?.message || String(err));
            }
        }

        // Never fail the whole UI with a 500 for image pipeline errors.
        // The caller treats missing `url` as "no image" and continues processing other products.
        console.error("Processing pipeline failed (all candidates):", pipelineLastErr);
        await safeUpsertRegistry({
            productCode,
            identityKey,
            canonicalName: term,
            brand,
            flavor,
            weight,
            source: providerUsed || 'external',
            validationLevel: validationLevelForRegistry,
            validatedBy: user.id,
            status: 'review_pending',
            reason: 'processing_failed_all_candidates'
        });
        return noImageResponse('processing_failed', {
            message: String(pipelineLastErr?.message || pipelineLastErr || 'unknown'),
            code: pipelineLastErr?.code,
            name: pipelineLastErr?.name,
            provider: providerUsed || 'external',
            candidateCount: candidates.length,
            attempts
        });
    } catch (err: any) {
        // Preserve expected HTTP errors (auth, validation, rate limit).
        const statusCode = Number(err?.statusCode || err?.status || 0) || 0;
        if ([400, 401, 403, 404, 409, 422, 429].includes(statusCode)) {
            throw err;
        }
        console.error('❌ [process-product-image] Unhandled error (returning 200):', err);
        return {
            found: false,
            url: null,
            source: 'error',
            reason: 'internal_error',
            provider: 'server',
            candidateCount: 0,
            attempts: 0,
            confidence: 0,
            reviewPending: true,
            imageReviewReason: 'Falha interna durante o processamento da imagem.',
            nextAction: 'Reprocessar em modo rápido ou aplicar imagem manualmente.',
            message: String(err?.message || err || 'unknown')
        };
    }
});
