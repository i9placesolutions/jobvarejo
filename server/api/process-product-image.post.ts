import { getS3Client, getPublicUrl } from "../utils/s3";
import { requireAuthenticatedUser } from "../utils/auth";
import { pgQuery } from "../utils/postgres";
import { enforceRateLimit } from "../utils/rate-limit";
import { redisGet, redisSetex } from "../utils/redis";
import {
    findProductImageCacheHitByTerms,
    incrementProductImageCacheUsage,
    saveProductImageCache
} from "../utils/product-image-cache";
import {
    buildDeterministicS3Key,
    buildExpandedNormalizedCandidates,
    findBestS3Match,
    findTopS3Matches,
    hasWeightInNormalized,
    normalizeSearchTerm,
    type RankedS3MatchCandidate
} from "../utils/product-image-matching";
import {
    ensureBgRemoved,
    s3KeyExists,
    type BgPolicy
} from "../utils/product-image-pipeline";
import {
    buildProductIdentityKey,
    findRegistryApprovedImage,
    upsertProductImageRegistry
} from "../utils/product-image-registry";
import { resolveStorageReadUrl } from "../utils/project-storage-refs";

type ReviewDecision = 'approved' | 'ambiguous' | 'blocked';
type ReviewCandidate = {
    id: string;
    url: string;
    previewUrl?: string;
    key?: string;
    title?: string;
    source: 'external' | 's3';
    provider: string;
    domain?: string;
    score?: number;
    confidence?: number;
    reason?: string;
    recommended?: boolean;
};

const userAssetNamesMemo = new Map<string, { expiresAt: number; data: Map<string, string> }>();

const getUserAssetNamesMap = async (userId: string): Promise<Map<string, string>> => {
    const cacheKey = String(userId || '').trim();
    if (!cacheKey) return new Map();

    const cached = userAssetNamesMemo.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
        return cached.data;
    }

    const next = new Map<string, string>();
    try {
        const { rows } = await pgQuery<{ asset_key: string; display_name: string }>(
            `select asset_key, display_name
             from public.asset_names
             where user_id = $1`,
            [cacheKey]
        );
        for (const row of rows || []) {
            const key = String(row?.asset_key || '').trim();
            const displayName = String(row?.display_name || '').trim();
            if (!key || !displayName) continue;
            next.set(key, displayName);
        }
    } catch {
        // asset_names pode nao existir ainda; manter busca resiliente.
    }

    userAssetNamesMemo.set(cacheKey, {
        expiresAt: now + 60_000,
        data: next
    });
    if (userAssetNamesMemo.size > 500) {
        const oldestKey = userAssetNamesMemo.keys().next().value;
        if (oldestKey) userAssetNamesMemo.delete(oldestKey);
    }

    return next;
};

const findExactAssetNameKey = (
    normalizedCandidates: string[],
    assetNamesByKey: Map<string, string>
): string | null => {
    if (!assetNamesByKey || assetNamesByKey.size === 0) return null;

    const candidateOrder = new Map<string, number>();
    const candidateSet = new Set<string>();
    normalizedCandidates
        .map((value) => normalizeSearchTerm(value))
        .filter(Boolean)
        .forEach((value, idx) => {
            if (!candidateSet.has(value)) candidateOrder.set(value, idx);
            candidateSet.add(value);
        });

    if (candidateSet.size === 0) return null;

    let best: { key: string; score: number } | null = null;
    for (const [key, displayName] of assetNamesByKey.entries()) {
        const normalizedDisplayName = normalizeSearchTerm(displayName);
        if (!normalizedDisplayName || !candidateSet.has(normalizedDisplayName)) continue;

        const tokenCount = normalizedDisplayName.split(' ').filter(Boolean).length;
        const candidateRank = Number(candidateOrder.get(normalizedDisplayName) ?? 999);
        const prefixBoost = key.startsWith('uploads/')
            ? 0.4
            : (key.startsWith('imagens/') ? 0.2 : 0);
        const score =
            (tokenCount * 10) +
            (normalizedDisplayName.length * 0.01) +
            prefixBoost -
            (candidateRank * 0.001);

        if (!best || score > best.score) {
            best = { key, score };
        }
    }

    return best?.key || null;
};

const sanitizeReviewCandidates = (input: unknown): ReviewCandidate[] => {
    if (!Array.isArray(input)) return [];
    const out: ReviewCandidate[] = [];
    for (let index = 0; index < input.length && out.length < 6; index++) {
        const entry = input[index] as any;
        const url = String(entry?.url || '').trim();
        const previewUrl = String(entry?.previewUrl || entry?.url || '').trim();
        const key = String(entry?.key || '').trim();
        if (!url && !previewUrl && !key) continue;
        const sourceRaw = String(entry?.source || '').trim().toLowerCase();
        const source: 'external' | 's3' = sourceRaw === 's3' ? 's3' : 'external';
        const provider = String(entry?.provider || sourceRaw || source || 'external').trim() || 'external';
        const score = Number(entry?.score);
        const confidence = Number(entry?.confidence);
        out.push({
            id: String(entry?.id || key || url || previewUrl || `candidate-${index + 1}`),
            url: url || previewUrl,
            previewUrl: previewUrl || url,
            key: key || undefined,
            title: String(entry?.title || '').trim() || undefined,
            source,
            provider,
            domain: String(entry?.domain || '').trim() || undefined,
            score: Number.isFinite(score) ? Number(score.toFixed(3)) : undefined,
            confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : undefined,
            reason: String(entry?.reason || '').trim() || undefined,
            recommended: !!entry?.recommended
        });
    }
    return out;
};



const decodeStorageCandidateTitle = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const lastPart = raw.split('/').pop() || raw;
    const withoutExt = lastPart.replace(/\.[^/.]+$/, '');
    try {
        return decodeURIComponent(withoutExt).replace(/[-_]+/g, ' ').trim();
    } catch {
        return withoutExt.replace(/[-_]+/g, ' ').trim();
    }
};

const buildInternalReviewCandidates = async (
    list: RankedS3MatchCandidate[],
    userId: string
): Promise<ReviewCandidate[]> => {
    const normalizedUserId = String(userId || '').trim();
    const limited = Array.isArray(list) ? list.slice(0, 6) : [];
    const results: ReviewCandidate[] = [];
    await Promise.all(limited.map(async (entry, index) => {
        const key = String(entry?.key || '').trim();
        if (!key) return;
        const resolvedUrl = await resolveStorageReadUrl(key, normalizedUserId);
        if (!resolvedUrl) return;
        const confidence = entry.kind === 'exact'
            ? 0.96
            : entry.kind === 'strict'
                ? 0.82
                : entry.kind === 'relaxed'
                    ? 0.68
                    : 0.54;
        results.push({
            id: `s3-${Buffer.from(key).toString('base64').slice(0, 12)}`,
            key,
            url: resolvedUrl,
            previewUrl: resolvedUrl,
            title: String(entry.alias || '').trim() || decodeStorageCandidateTitle(key) || undefined,
            source: 's3' as const,
            provider: 'internal',
            score: Number.isFinite(Number(entry.score)) ? Number(Number(entry.score).toFixed(3)) : undefined,
            confidence,
            reason: String(entry.reason || '').trim() || undefined,
            recommended: index === 0
        });
    }));
    return results;
};

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
    'coco', 'chocolate', 'baunilha', 'cafe', 'caramelo', 'menta',
    'integral', 'desnatado', 'semidesnatado', 'lactose', 'organico', 'natural',
    'mini', 'max', 'plus', 'ultra', 'suave', 'forte', 'premium', 'gold'
]);
const NUMERIC_SIGNAL_TOKEN_RE = /^\d{2,}$/;
const PRODUCT_CODE_SIGNAL_TOKEN_RE = /^\d{4,}$/;

const extractWeightTokens = (value: string): string[] =>
    tokenizeNormalized(value, 1)
        .filter((token) => WEIGHT_TOKEN_RE.test(token) || MULTIPACK_WEIGHT_TOKEN_RE.test(token))
        .filter((token, idx, arr) => arr.indexOf(token) === idx);

const extractVariantTokens = (value: string): string[] =>
    tokenizeNormalized(value, 1)
        .filter((token) => VARIANT_CONFLICT_TOKENS.has(token))
        .filter((token, idx, arr) => arr.indexOf(token) === idx);

const extractNumericSignalTokens = (value: string, minLen = 2): string[] =>
    tokenizeNormalized(value, 1)
        .filter((token) => token.length >= minLen)
        .filter((token) => NUMERIC_SIGNAL_TOKEN_RE.test(token))
        .filter((token, idx, arr) => arr.indexOf(token) === idx);

const extractProductCodeSignalTokens = (value: string): string[] =>
    extractNumericSignalTokens(value, 4).filter((token) => PRODUCT_CODE_SIGNAL_TOKEN_RE.test(token));

const hasTokenIntersection = (a: string[], bSet: Set<string>): boolean => {
    for (const token of a) {
        if (bSet.has(token)) return true;
    }
    return false;
};

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default defineEventHandler(async (event) => {
    try {
        const user = await requireAuthenticatedUser(event);
        await enforceRateLimit(event, `process-product-image:${user.id}`, 30, 60_000);

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
        const selectedCandidateInput = body?.selectedCandidate && typeof body?.selectedCandidate === 'object'
            ? sanitizeReviewCandidates([body.selectedCandidate])[0] || null
            : null;
    const matchMode = String(body?.matchMode || '').toLowerCase() === 'fast' ? 'fast' : 'precise';
    const strictMode = matchMode === 'precise' ? true : !!body?.strictMode;
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
            const {
                candidates: rawCandidates,
                reviewPending: reviewPendingOverride,
                decision: decisionOverride,
                ...restDetails
            } = details || {};
            const fallbackNextAction = (() => {
                if (!strictMode) return undefined;
                if (reasonText.includes('external_search_config_missing') || reasonText.includes('external_search_disabled')) {
                    return 'Ative a busca externa nas configurações e reprocessar, ou aplique imagem manualmente.';
                }
                if (reasonText.includes('no_candidates') || reasonText.includes('metadata_gate_rejected')) {
                    return 'Tente ajustar o termo principal (marca + peso) e reprocesse, ou use imagem manual.';
                }
                if (reasonText.includes('processing_failed')) {
                    return 'Reprocessar com política de busca rápida ou fazer upload manual em seguida.';
                }
                return 'Revise manualmente e escolha outra fonte de imagem.';
            })();

            const provider = restDetails?.provider || 'external';
            const source = String(restDetails?.provider || 'external');
            const candidates = sanitizeReviewCandidates(rawCandidates);
            const reviewPending = reviewPendingOverride === undefined ? strictMode : !!reviewPendingOverride;
            const candidateCount = Number(restDetails?.candidateCount || candidates.length || candidateNormalizedTerms.length || 0);
            const attempts = Number(restDetails?.attempts || 0);
            const confidence = Number.isFinite(Number(restDetails?.confidence))
                ? Math.max(0, Math.min(1, Number(restDetails.confidence)))
                : 0;
            const decision: ReviewDecision = decisionOverride
                ? decisionOverride
                : (reviewPending && candidates.length > 0 ? 'ambiguous' : 'blocked');

            return {
                found: false,
                url: null,
                source,
                reason: reasonText,
                provider: source,
                candidateCount: candidateCount,
                attempts,
                confidence,
                reviewPending,
                decision,
                reviewReason: String(restDetails?.reviewReason || reasonText || ''),
                imageReviewReason: String(restDetails?.imageReviewReason || reasonText || ''),
                nextAction: String(restDetails?.nextAction || fallbackNextAction || ''),
                candidates,
                ...(restDetails || {})
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

        const processSelectedCandidate = async () => {
            if (!selectedCandidateInput) return null;

            const candidate = selectedCandidateInput;
            const candidateKey = String(candidate.key || '').trim();
            const candidateUrl = String(candidate.url || '').trim();
            const candidateConfidence = Number.isFinite(Number(candidate.confidence))
                ? Math.max(0, Math.min(1, Number(candidate.confidence)))
                : 0.98;

            if (candidate.source === 's3' && candidateKey) {
                const exists = await s3KeyExists(s3, bucketName, candidateKey);
                if (!exists) {
                    return noImageResponse('selected_candidate_missing', {
                        provider: candidate.provider || 'internal',
                        reviewPending: true,
                        decision: 'blocked',
                        nextAction: 'A candidata escolhida não existe mais no storage. Busque novamente no storage.',
                        imageReviewReason: 'A imagem escolhida não foi encontrada no storage.'
                    });
                }

                if (bgPolicy === 'always') {
                    const processed = await ensureBgRemoved({
                        s3,
                        bucketName,
                        sourceKey: candidateKey,
                        deterministicKey,
                        normalizedTerm,
                        term,
                        brand,
                        flavor,
                        weight
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
                            source: 'manual-choice-s3',
                            validationLevel: 'manual-review-choice',
                            validatedBy: user.id,
                            status: 'approved'
                        });
                        return {
                            source: processed.processed ? 'internal-processed' : 'internal',
                            url: await resolveStorageReadUrl(processed.key, user.id),
                            key: processed.key,
                            provider: candidate.provider || 'internal',
                            confidence: candidateConfidence,
                            candidateCount: 1,
                            attempts: 1,
                            reviewPending: false,
                            decision: 'approved' as ReviewDecision,
                            candidates: []
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
                    s3Key: candidateKey,
                    source: 'manual-choice-s3',
                    validationLevel: 'manual-review-choice',
                    validatedBy: user.id,
                    status: 'approved'
                });
                return {
                    source: 'internal',
                    url: await resolveStorageReadUrl(candidateKey, user.id),
                    key: candidateKey,
                    provider: candidate.provider || 'internal',
                    confidence: candidateConfidence,
                    candidateCount: 1,
                    attempts: 1,
                    reviewPending: false,
                    decision: 'approved' as ReviewDecision,
                    candidates: []
                };
            }

            // Busca externa removida — apenas candidatas do storage (source === 's3') são suportadas.
            return noImageResponse('only_s3_candidates_supported', {
                provider: 'internal',
                reviewPending: true,
                decision: 'blocked',
                nextAction: 'Escolha uma imagem do storage ou faça upload manual.',
                imageReviewReason: 'Apenas imagens do storage Wasabi são suportadas. Faça upload manual para usar imagens externas.'
            });
        };

        if (!String(bucketName || '').trim()) {
            console.warn('⚠️ [process-product-image] wasabiBucket ausente no runtime config.');
            return noImageResponse('wasabi_bucket_missing', { missingConfig: ['wasabiBucket'] });
        }

        console.log(`🔍 [Search] Termo: "${primarySearchInput}" → Normalizado: "${normalizedTerm}" → Key: "${deterministicKey}"`);
        if (candidateNormalizedTerms.length > 1) {
            console.log(`🧭 [Search Variants] ${candidateNormalizedTerms.length} variantes:`, candidateNormalizedTerms.slice(0, 8));
        }

        const redisCacheKey = `img:${normalizedTerm}`

        // Redis cache — evita pipeline completo para o mesmo produto
        if (!selectedCandidateInput) {
            const cachedS3Key = await redisGet(redisCacheKey)
            if (cachedS3Key) {
                const exists = await s3KeyExists(s3, bucketName, cachedS3Key)
                if (exists) {
                    console.log(`⚡ [Redis] Cache hit: "${normalizedTerm}" → "${cachedS3Key}"`)
                    return {
                        source: 'redis-cache',
                        url: await resolveStorageReadUrl(cachedS3Key, user.id),
                        key: cachedS3Key,
                        provider: 'internal',
                        confidence: 0.99,
                        candidateCount: 0,
                        attempts: 0,
                        reviewPending: false
                    }
                }
            }
        }

        const selectedCandidateResult = await processSelectedCandidate();
        if (selectedCandidateResult) {
            return selectedCandidateResult;
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

        void redisSetex(redisCacheKey, 86400, candidateKey)
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
    let internalReviewCandidates: ReviewCandidate[] = [];
    try {
        const assetNamesByKey = await getUserAssetNamesMap(String(user.id || ''));
        const exactAssetNameKey = findExactAssetNameKey(candidateNormalizedTerms, assetNamesByKey);
        if (exactAssetNameKey) {
            const exists = await s3KeyExists(s3, bucketName, exactAssetNameKey);
            if (exists) {
                console.log(`OK [S3 Match:asset-name-exact] Reuse: "${exactAssetNameKey}"`);

                if (bgPolicy === 'always') {
                    const processed = await ensureBgRemoved({
                        s3, bucketName,
                        sourceKey: exactAssetNameKey,
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
                            validationLevel: 'bucket-alias-exact',
                            validatedBy: user.id,
                            status: 'approved'
                        });
                        return {
                            source: processed.processed ? 'internal-processed' : 'internal',
                            url: await resolveStorageReadUrl(processed.key, user.id),
                            key: processed.key,
                            provider: 'internal',
                            confidence: 0.995,
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
                    imageUrl: getPublicUrl(exactAssetNameKey),
                    s3Key: exactAssetNameKey,
                    source: 'internal-exact-name'
                });
                await safeUpsertRegistry({
                    productCode,
                    identityKey,
                    canonicalName: term,
                    brand,
                    flavor,
                    weight,
                    s3Key: exactAssetNameKey,
                    source: 'internal',
                    validationLevel: 'bucket-alias-exact',
                    validatedBy: user.id,
                    status: 'approved'
                });

                void redisSetex(redisCacheKey, 86400, exactAssetNameKey)
                return {
                    source: 'internal',
                    url: await resolveStorageReadUrl(exactAssetNameKey, user.id),
                    key: exactAssetNameKey,
                    provider: 'internal',
                    confidence: 0.995,
                    candidateCount: 1,
                    attempts: 1,
                    reviewPending: false
                };
            }

            console.warn(`⚠️ [S3 Match:asset-name-exact] asset_names apontou para key inexistente: ${exactAssetNameKey}`);
        }

        const found = await findBestS3Match({
            s3,
            bucketName,
            prefixes: ['uploads/', 'imagens/', 'logo/'],
            normalizedCandidates: candidateNormalizedTerms,
            brand,
            flavor,
            weight,
            productCode,
            strictOnly: strictMode,
            keyAliases: assetNamesByKey,
            cacheNamespace: String(user.id || ''),
            maxKeysPerPrefix: 12_000
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

            void redisSetex(redisCacheKey, 86400, found)
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

        const rankedInternalMatches = await findTopS3Matches({
            s3,
            bucketName,
            prefixes: ['uploads/', 'imagens/', 'logo/'],
            normalizedCandidates: candidateNormalizedTerms,
            brand,
            flavor,
            weight,
            productCode,
            strictOnly: strictMode,
            keyAliases: assetNamesByKey,
            cacheNamespace: String(user.id || ''),
            maxKeysPerPrefix: 12_000,
            limit: 6
        });
        internalReviewCandidates = await buildInternalReviewCandidates(rankedInternalMatches, String(user.id || ''));
        if (internalReviewCandidates.length > 0) {
            console.log(`ℹ️ [S3 Match:candidates] ${internalReviewCandidates.length} candidata(s) internas para revisão.`);
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
                void redisSetex(redisCacheKey, 86400, cacheResolvedKey)
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

    // ========================================
    // Nenhuma imagem encontrada no Wasabi
    // Busca externa removida — apenas storage interno.
    // ========================================
    await safeUpsertRegistry({
        productCode,
        identityKey,
        canonicalName: term,
        brand,
        flavor,
        weight,
        source: 'internal',
        validationLevel: 'bucket-no-match',
        validatedBy: user.id,
        status: 'review_pending',
        reason: 'no_internal_match'
    });

    if (internalReviewCandidates.length > 0) {
        return noImageResponse(`No exact match in storage for "${term}"`, {
            provider: 'internal',
            candidateCount: internalReviewCandidates.length,
            attempts: 0,
            confidence: 0.62,
            reviewPending: true,
            decision: 'ambiguous',
            candidates: internalReviewCandidates,
            imageReviewReason: 'Não encontramos imagem exata no storage. Escolha uma das sugestões ou faça upload manual.',
            nextAction: 'Escolha uma imagem do storage ou faça upload manual.'
        });
    }

    return noImageResponse(`No image found in storage for "${term}"`, {
        provider: 'internal',
        candidateCount: 0,
        attempts: 0,
        confidence: 0,
        imageReviewReason: 'Nenhuma imagem encontrada no storage para este produto.',
        nextAction: 'Faça upload manual da imagem do produto.'
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
