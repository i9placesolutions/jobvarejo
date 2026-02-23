import { getS3Client, getPublicUrl } from "../utils/s3";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { validateProductImageCandidatesWithAI } from "../utils/product-image-ai";
import { searchGoogleCseImageCandidates } from "../utils/product-image-google-cse";
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

/** Build a same-origin proxy URL for a given S3 key (avoids CORS + no expiration) */
const proxyUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`;

const normalizeCompact = (value: string): string =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

const passesMetadataHardGate = (opts: {
    title?: string;
    source?: string;
    term: string;
    brand?: string;
    flavor?: string;
    weight?: string;
}): boolean => {
    const haystack = normalizeCompact([opts.title, opts.source].filter(Boolean).join(' '));
    const mustContain = [opts.brand, opts.flavor, opts.weight]
        .map((part) => normalizeCompact(String(part || '')))
        .filter(Boolean);

    for (const token of mustContain) {
        if (!haystack.includes(token)) return false;
    }

    const termTokens = normalizeCompact(opts.term).match(/[a-z0-9]{3,}/g) || [];
    if (termTokens.length === 0) return true;
    let hits = 0;
    for (const t of termTokens) {
        if (haystack.includes(t)) hits++;
    }
    return hits >= Math.max(1, Math.ceil(termTokens.length * 0.5));
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

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default defineEventHandler(async (event) => {
    try {
        const user = await requireAuthenticatedUser(event);
        enforceRateLimit(event, `process-product-image:${user.id}`, 30, 60_000);

        const body = await readBody(event);
        const term = String(body?.term || '').trim();
        const rawSearchHints = Array.isArray(body?.searchHints) ? body.searchHints : [];
        const searchHints = rawSearchHints
            .map((entry: any) => String(entry || '').trim())
            .filter(Boolean)
            .slice(0, 8);
        const brand = String(body?.brand || '').trim() || undefined;
        const flavor = String(body?.flavor || '').trim() || undefined;
        const weight = String(body?.weight || '').trim() || undefined;
        const productCode = String(body?.productCode || '').trim() || undefined;
        const strictMode = body?.strictMode === undefined ? true : !!body?.strictMode;
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
        const noImageResponse = (reason: string, details?: Record<string, any>) => ({
            found: false,
            url: null,
            source: 'external',
            reason,
            reviewPending: strictMode,
            ...(details || {})
        });
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
                return { source: 'registry', url: proxyUrl(registryKey) };
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

        return { source: 'cache-s3', url: proxyUrl(candidateKey) };
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
                    return { source: processed.processed ? 'internal-processed' : 'internal', url: proxyUrl(processed.key) };
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

            return { source: 'internal', url: proxyUrl(found) };
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
                console.log(`✅ [Cache DB] Hit exato para "${term}" (source: ${cacheHit.source})`);
                // Incrementar usage_count (fire-and-forget — OK para counter)
                void incrementProductImageCacheUsage(cacheHit.id);

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
                        return { source: 'cache-processed', url: proxyUrl(processed.key) };
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
                return { source: 'cache', url: proxyUrl(cacheResolvedKey) };
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

    const hasGoogleCse = !!(config.googleCseApiKey && config.googleCseCx);
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
        return noImageResponse('external_search_disabled', { reviewPending: true });
    }

    if (!hasGoogleCse && !hasSerper) {
        console.warn('⚠️ [process-product-image] Nenhum provider de busca externa configurado (Google CSE/Serper).');
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
            missingConfig: ['googleCseApiKey+googleCseCx OR serperApiKey']
        });
    }

    let candidates: { url: string; title?: string; source?: string }[] = [];
    let providerUsed: 'google-cse' | 'serper' | null = null;
    let lastProviderError: Record<string, any> | null = null;
    const externalQueryVariants = buildExternalQueryVariants({
        primarySearchInput,
        searchQuery,
        term,
        brand,
        weight,
        flavor
    });

    if (hasGoogleCse) {
        for (const q of externalQueryVariants) {
            const googleCseResult = await searchGoogleCseImageCandidates({
                apiKey: config.googleCseApiKey,
                cx: config.googleCseCx,
                query: `${q} produto embalagem`,
                gl: 'br',
                hl: 'pt-br',
                num: 10,
                maxCandidates: 6,
                timeoutMs: 12_000
            });
            if (googleCseResult.error) {
                lastProviderError = { provider: 'google-cse', query: q, ...googleCseResult.error };
                console.warn(`⚠️ [Google CSE] erro (${googleCseResult.error.kind}) para query="${q}", tentando próxima variação.`);
                continue;
            }
            if (googleCseResult.candidates.length > 0) {
                candidates = googleCseResult.candidates;
                providerUsed = 'google-cse';
                console.log(`✅ [Google CSE] candidatas encontradas com query="${q}"`);
                break;
            }
        }
    }

    if (candidates.length === 0 && hasSerper) {
        for (const q of externalQueryVariants) {
            const serperResult = await searchSerperImageCandidates({
                apiKey: config.serperApiKey,
                query: `${q} produto embalagem`,
                gl: 'br',
                hl: 'pt-br',
                num: 10,
                maxCandidates: 6,
                timeoutMs: 12_000
            });
            if (serperResult.error) {
                lastProviderError = { provider: 'serper', query: q, ...serperResult.error };
                console.warn(`⚠️ [Serper] erro (${serperResult.error.kind}) para query="${q}".`);
                continue;
            }
            if (serperResult.candidates.length > 0) {
                candidates = serperResult.candidates;
                providerUsed = 'serper';
                console.log(`✅ [Serper] candidatas encontradas com query="${q}"`);
                break;
            }
        }
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
            externalError: lastProviderError || undefined
        });
    }

    const gatedCandidates = candidates.filter((entry) => passesMetadataHardGate({
        title: entry.title,
        source: entry.source,
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
            reason: 'metadata_gate_rejected'
        });
    }

    // ========================================
    // 2.5 VALIDAÇÃO IA: GPT-4o Vision escolhe a melhor imagem
    // ========================================
    let selectedImageUrl = '';
    if (!config.openaiApiKey) {
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
            reason: 'openai_validation_missing'
        });
    }

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
        const bestIndexValid = validation.bestIndex >= 0 && validation.bestIndex < candidates.length;
        if (!bestIndexValid || !validation.isExactMatch || validation.confidence < confidenceThreshold) {
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
                    ...validation.mismatchReasons
                ].join('; ')
            });
            return noImageResponse(`No reliable image found for "${term}"`, {
                aiConfidence: validation.confidence,
                aiBestIndex: validation.bestIndex,
                aiExactMatch: validation.isExactMatch,
                aiMismatchReasons: validation.mismatchReasons
            });
        }

        selectedImageUrl = candidates[validation.bestIndex]!.url;
        console.log(`🎯 [AI] Selecionada imagem ${validation.bestIndex + 1}/${candidates.length} com ${(validation.confidence * 100).toFixed(0)}% confiança`);
    } catch (err) {
        console.warn('⚠️ [AI] Validação estrita falhou:', (err as any)?.message);
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
            reason: 'ai_validation_failed'
        });
    }

    // ========================================
    // 3. PROCESS + UPLOAD PIPELINE (S3 key determinístico)
    // ========================================
        try {
            const pipelineResult = await runExternalPipelineOnce({
                s3,
                bucketName,
                deterministicKey,
                normalizedTerm,
                term,
                brand,
                flavor,
                weight,
                selectedImageUrl,
                bgPolicy
            });
            const resolvedKey = String(
                (pipelineResult?.url && pipelineResult.url.includes('/api/storage/p?key='))
                    ? decodeURIComponent((pipelineResult.url.split('key=')[1] || '').split('&')[0] || '')
                    : deterministicKey
            ).trim() || deterministicKey;
            await safeUpsertRegistry({
                productCode,
                identityKey,
                canonicalName: term,
                brand,
                flavor,
                weight,
                s3Key: resolvedKey,
                source: providerUsed || 'external',
                validationLevel: 'ocr+ai-strict',
                validatedBy: user.id,
                status: 'approved'
            });
            return pipelineResult;
        } catch (err: any) {
            // Never fail the whole UI with a 500 for image pipeline errors.
            // The caller treats missing `url` as "no image" and continues processing other products.
            console.error("Processing pipeline failed:", err);
            await safeUpsertRegistry({
                productCode,
                identityKey,
                canonicalName: term,
                brand,
                flavor,
                weight,
                source: providerUsed || 'external',
                validationLevel: 'ocr+ai-strict',
                validatedBy: user.id,
                status: 'review_pending',
                reason: 'processing_failed'
            });
            return noImageResponse('processing_failed', {
                message: String(err?.message || err || 'unknown'),
                code: err?.code,
                name: err?.name
            });
        }
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
            message: String(err?.message || err || 'unknown')
        };
    }
});
