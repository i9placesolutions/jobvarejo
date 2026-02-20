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

/** Build a same-origin proxy URL for a given S3 key (avoids CORS + no expiration) */
const proxyUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`;

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
        if ((brand && brand.length > 120) || (flavor && flavor.length > 120) || (weight && weight.length > 60)) {
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
            ...(details || {})
        });

        if (!String(bucketName || '').trim()) {
            console.warn('⚠️ [process-product-image] wasabiBucket ausente no runtime config.');
            return noImageResponse('wasabi_bucket_missing', { missingConfig: ['wasabiBucket'] });
        }

        console.log(`🔍 [Search] Termo: "${primarySearchInput}" → Normalizado: "${normalizedTerm}" → Key: "${deterministicKey}"`);
        if (candidateNormalizedTerms.length > 1) {
            console.log(`🧭 [Search Variants] ${candidateNormalizedTerms.length} variantes:`, candidateNormalizedTerms.slice(0, 8));
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
            normalizedCandidates: candidateNormalizedTerms
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
                        return { source: 'cache-processed', url: proxyUrl(processed.key) };
                    }
                }
                return { source: 'cache', url: proxyUrl(cacheResolvedKey) };
            }
        }
    } catch (err) {
        console.warn("⚠️ [Cache DB] Falha na consulta:", (err as any)?.message);
    }

    // ========================================
    // 2. EXTERNAL SEARCH (Serper.dev) + VALIDAÇÃO IA
    // ========================================
    if (!config.serperApiKey) {
        console.warn('⚠️ [process-product-image] serperApiKey ausente no runtime config; pulando busca externa.');
        return noImageResponse('serper_api_key_missing', { missingConfig: ['serperApiKey'] });
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

    const serperResult = await searchSerperImageCandidates({
        apiKey: config.serperApiKey,
        query: `${searchQuery} produto embalagem`,
        gl: 'br',
        hl: 'pt-br',
        num: 10,
        maxCandidates: 5,
        timeoutMs: 12_000
    });
    if (serperResult.error) {
        if (serperResult.error.kind === 'http') {
            console.warn(`⚠️ [Serper] HTTP ${serperResult.error.status} ${serperResult.error.statusText || ''} for query="${searchQuery}"`);
            return noImageResponse('external_search_failed', {
                provider: 'serper',
                status: serperResult.error.status,
                statusText: serperResult.error.statusText,
                body: serperResult.error.body
            });
        }
        if (serperResult.error.kind === 'invalid_response') {
            return noImageResponse('external_search_invalid_response', { provider: 'serper' });
        }
        console.error("Serper API error:", serperResult.error.message);
        return noImageResponse('external_search_failed', {
            provider: 'serper',
            message: serperResult.error.message || 'Unknown Serper error'
        });
    }
    const candidates = serperResult.candidates;

    if (candidates.length === 0) {
        return noImageResponse(`No image found for "${term}"`);
    }

    // ========================================
    // 2.5 VALIDAÇÃO IA: GPT-4o Vision escolhe a melhor imagem
    // ========================================
    let selectedImageUrl = candidates[0]!.url; // fallback

    if (config.openaiApiKey && candidates.length > 1) {
        try {
            const validation = await validateProductImageCandidatesWithAI(candidates, {
                name: term,
                brand: brand || undefined,
                flavor: flavor || undefined,
                weight: weight || undefined,
                normalizedQuery: normalizedTerm
            });

            if (validation.bestIndex >= 0 && validation.bestIndex < candidates.length) {
                if (validation.confidence >= 0.55) {
                    selectedImageUrl = candidates[validation.bestIndex]!.url;
                    console.log(`🎯 [AI] Selecionada imagem ${validation.bestIndex + 1}/${candidates.length} com ${(validation.confidence * 100).toFixed(0)}% confiança`);
                } else {
                    return noImageResponse(`No reliable image found for "${term}" (AI confidence ${(validation.confidence * 100).toFixed(0)}%)`, {
                        aiConfidence: validation.confidence,
                        aiBestIndex: validation.bestIndex
                    });
                }
            } else if (validation.bestIndex === -1) {
                return noImageResponse(`No matching image found for "${term}" (AI rejected candidates)`, {
                    aiConfidence: validation.confidence,
                    aiBestIndex: validation.bestIndex
                });
            }
        } catch (err) {
            console.warn('⚠️ [AI] Validação falhou, usando primeira imagem:', (err as any)?.message);
        }
    } else if (candidates.length === 1) {
        console.log('📷 [Serper] Apenas 1 candidata, pulando validação IA');
    }

    // ========================================
    // 3. PROCESS + UPLOAD PIPELINE (S3 key determinístico)
    // ========================================
        try {
            return await runExternalPipelineOnce({
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
        } catch (err: any) {
            // Never fail the whole UI with a 500 for image pipeline errors.
            // The caller treats missing `url` as "no image" and continues processing other products.
            console.error("Processing pipeline failed:", err);
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
