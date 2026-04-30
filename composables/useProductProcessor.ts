import { toWasabiDirectUrl } from '~/utils/storageProxy';

export interface SmartProductImageCandidate {
    id: string;
    url: string;
    previewUrl?: string | null;
    key?: string | null;
    title?: string | null;
    source?: 's3' | 'external' | 'manual' | string;
    provider?: string | null;
    domain?: string | null;
    score?: number | null;
    confidence?: number | null;
    reason?: string | null;
    recommended?: boolean;
}

export interface SmartProduct {
    id: string;
    productId?: string | null;
    productInstanceId?: string | null;
    zoneInstanceId?: string | null;
    name: string;
    productCode?: string | null;
    brand: string | null;
    weight: string | null;
    // ===== PREÇOS SIMPLES (legado - mantido para compatibilidade) =====
    price: string | null;
    // ===== PREÇOS POR EMBALAGEM/UNIDADE =====
    // Preço da embalagem/caixa avulsa (PREÇO CX. AVULSA)
    pricePack?: string | null;
    // Preço unitário avulso (PREÇO UND. AVULSA)
    priceUnit?: string | null;
    // ===== PREÇOS ESPECIAIS/PROMOCIONAIS =====
    // Preço especial da embalagem (PREÇO ESPECIAL / PREÇO ACIMA X EMBA.)
    priceSpecial?: string | null;
    // Preço unitário especial (PREÇO ESPECIAL UN. / PREÇO UND. ACIMA X EMB)
    priceSpecialUnit?: string | null;
    // Condição para preço especial (OBSERVAÇÕES: "ACIMA DE 36 UN.", "ACIMA DE 2 FARDOS")
    specialCondition?: string | null;
    // ===== WHOLESALE/ATACADO (legado - mantido para compatibilidade) =====
    priceWholesale?: string | null;
    wholesaleTrigger?: number | null;
    wholesaleTriggerUnit?: string | null;
    // ===== METADATA DE EMBALAGEM =====
    packQuantity?: number | null;
    packUnit?: string | null;
    packageLabel?: string | null;
    // ===== OUTROS =====
    price_mode: string;
    limit: string | null;
    flavor: string | null;
    imageUrl: string | null;
    status: 'pending' | 'processing' | 'done' | 'error' | 'review_pending';
    error?: string;
    imageDecisionReason?: string;
    imageConfidence?: number;
    imageSource?: 'cache' | 's3' | 'ai' | 'manual' | 'fallback';
    imageProvider?: string;
    imageAttemptCount?: number;
    imageCandidateCount?: number;
    imageReviewReason?: string;
    imageDecision?: 'approved' | 'ambiguous' | 'blocked';
    imageCandidates?: SmartProductImageCandidate[];
    // Original extracted data
    raw?: any;
}

type BgPolicy = 'auto' | 'never' | 'always';
type ImageMatchMode = 'precise' | 'fast';
type ImageProcessResult = {
    ok: boolean;
    rateLimited?: boolean;
    retryAfterMs?: number;
    confidence?: number;
    source?: string;
    imageProvider?: string;
    candidateCount?: number;
    attempts?: number;
    nextAction?: string;
    reviewPending?: boolean;
    decision?: 'approved' | 'ambiguous' | 'blocked';
    candidates?: SmartProductImageCandidate[];
};
type ImageProcessOptions = {
    bgPolicy?: BgPolicy;
    force?: boolean;
    matchMode?: ImageMatchMode;
    selectedCandidate?: SmartProductImageCandidate | null;
};
type ImageQueueState = {
    total: number;
    done: number;
    failed: number;
    retrying: number;
    inFlight: number;
    running: boolean;
    paused: boolean;
    cancelled: boolean;
};

// Normaliza search term no frontend (espelha lógica do backend)
const normalizeForDedup = (term: string): string => {
    const unitMap: Record<string, string> = {
        mililitros: 'ml', mililitro: 'ml', mls: 'ml',
        gramas: 'g', grama: 'g', gram: 'g', gr: 'g', grs: 'g', gs: 'g',
        quilos: 'kg', quilo: 'kg', quilogramas: 'kg', quilograma: 'kg', kgs: 'kg',
        unidades: 'un', unidade: 'un', und: 'un', unds: 'un', uns: 'un',
        litro: 'l', litros: 'l', lt: 'l', lts: 'l',
        pacote: 'pct', pacotes: 'pct', pcts: 'pct',
        caixa: 'cx', caixas: 'cx',
        fardo: 'fd', fardos: 'fd',
    };
    const stopWords = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'com', 'em', 'e', 'para', 'por', 'no', 'na']);

    const words = term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/(\d)[,](\d)/g, '$1.$2')
        .replace(/[^a-z0-9.\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(w => !stopWords.has(w) && w.length > 0)
        .map(w => unitMap[w] || w);
    // Deduplicar e ordenar alfabeticamente (consistente com normalizeSearchTerm do backend)
    const set = new Set(words);
    return [...set].sort().join(' ');
};

const normalizeWeightNumber = (value: string): string => {
    const n = Number(String(value || '').replace(',', '.'));
    if (!Number.isFinite(n)) return String(value || '').replace(',', '.');
    const normalized = String(n);
    return normalized.includes('.') ? normalized.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : normalized;
};

const canonicalizeWeightUnit = (rawUnit: string): string => {
    const u = String(rawUnit || '').toUpperCase();
    if (u === 'GR' || u === 'GRS') return 'G';
    if (u === 'LT' || u === 'LTS') return 'L';
    if (u === 'KGS') return 'KG';
    if (u === 'MLS') return 'ML';
    return u;
};

const normalizeWeightToken = (rawWeight: string): string => {
    const compact = String(rawWeight || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/GRS?\b/g, 'G')
        .replace(/LTS?\b/g, 'L')
        .replace(/KGS\b/g, 'KG')
        .replace(/MLS\b/g, 'ML');

    const multipack = compact.match(/^(\d+)X(\d+(?:\.\d+)?)(KG|KGS|G|GR|GRS|MG|ML|MLS|L|LT|LTS|UN)$/);
    if (multipack) {
        const multiplier = String(Number(multipack[1] || '0'));
        const qty = normalizeWeightNumber(multipack[2] || '0');
        const unit = canonicalizeWeightUnit(multipack[3] || '');
        return `${multiplier}X${qty}${unit}`;
    }

    const single = compact.match(/^(\d+(?:\.\d+)?)(KG|KGS|G|GR|GRS|MG|ML|MLS|L|LT|LTS|UN)$/);
    if (single) {
        const qty = normalizeWeightNumber(single[1] || '0');
        const unit = canonicalizeWeightUnit(single[2] || '');
        return `${qty}${unit}`;
    }

    return compact;
};

// Extrai peso/volume do nome do produto quando o campo weight está vazio
const extractWeightFromName = (name: string): string | null => {
    if (!name) return null;
    // Padrões: "250ML", "500GR", "1KG", "2L", "1,5L", "350 ML", "12x500ML"
    const match = name.match(/(\d+\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:ML|MLS|G|GR|GRS|KG|KGS|L|LT|LTS|MG|UN)\b|\d+(?:[.,]\d+)?\s*(?:ML|MLS|G|GR|GRS|KG|KGS|L|LT|LTS|MG|UN)\b)/i);
    return match ? normalizeWeightToken(match[0]) : null;
};

const FLAVOR_SKIP_SET = new Set(['sabores', 'fragrâncias', 'fragancias', 'variados', 'sortidos', 'diversos']);

const buildSearchHintCandidates = (product: SmartProduct, effectiveWeight?: string | null): string[] => {
    const name = String(product.name || '').trim();
    if (!name) return [];

    const brand = String(product.brand || '').trim();
    const flavorRaw = String(product.flavor || '').trim();
    const flavor = flavorRaw && !FLAVOR_SKIP_SET.has(flavorRaw.toLowerCase()) ? flavorRaw : '';
    const explicitWeight = product.weight ? normalizeWeightToken(product.weight) : '';
    const weightToUse = effectiveWeight || explicitWeight || '';

    const weightVariants = [weightToUse, explicitWeight]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

    const seen = new Set<string>();
    const out: string[] = [];
    const pushVariant = (...parts: Array<string | null | undefined>) => {
        const text = parts
            .map((part) => String(part || '').trim())
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) return;
        const dedupKey = normalizeForDedup(text);
        if (!dedupKey || seen.has(dedupKey)) return;
        seen.add(dedupKey);
        out.push(text);
    };

    for (const weight of weightVariants) {
        pushVariant(name, brand, flavor, weight);
        pushVariant(name, brand, weight);
        pushVariant(name, weight);
    }

    pushVariant(name, brand, flavor);
    pushVariant(name, brand);
    pushVariant(name);

    return out.slice(0, 8);
};

// Monta search term a partir do produto
const buildSearchTerm = (product: SmartProduct, effectiveWeight?: string | null): string => {
    const candidates = buildSearchHintCandidates(product, effectiveWeight);
    return candidates[0] || String(product.name || '').trim();
};

const buildDedupSignature = (product: SmartProduct): string => {
    const effectiveWeight = extractWeightFromName(product.name) || (product.weight ? normalizeWeightToken(product.weight) : '') || '';
    const signatureParts = [
        product.productCode || '',
        product.name || '',
        product.brand || '',
        product.flavor || '',
        effectiveWeight
    ].filter(Boolean);
    return normalizeForDedup(signatureParts.join(' ').trim());
};

export const useProductProcessor = () => {
    const { getApiAuthHeaders } = useApiAuth();
    const products = ref<SmartProduct[]>([]);
    const isParsing = ref(false);
    const parsingError = ref<string | null>(null);
    const createInitialImageQueueState = (): ImageQueueState => ({
        total: 0,
        done: 0,
        failed: 0,
        retrying: 0,
        inFlight: 0,
        running: false,
        paused: false,
        cancelled: false
    });
    const imageQueueState = ref<ImageQueueState>(createInitialImageQueueState());
    const processingRunId = ref(0);

    const normalizeImageSource = (source?: string): SmartProduct['imageSource'] => {
        const value = String(source || '').toLowerCase();
        if (!value) return 'fallback';
        if ([
            'cache',
            'cache-s3',
            'cache-db',
            'cache-processed',
            'storage'
        ].includes(value)) return 'cache';
        if ([
            'internal',
            'internal-processed',
            'internal-fallback',
            'registry',
            's3'
        ].includes(value)) return 's3';
        if ([
            'ai',
            'ocr+ai-strict',
            'ocr+fallback-ai-low-confidence',
            'ocr+fallback-no-openai',
            'ocr+fallback-ai-error'
        ].includes(value)) return 'ai';
        if ([
            'manual',
            'manual-fallback',
            'manual-presigned'
        ].includes(value)) return 'manual';
        if (value === 'external') return 'ai';
        return 'fallback';
    };

    const normalizeSmartProductCandidates = (input: any): SmartProductImageCandidate[] => {
        if (!Array.isArray(input)) return [];
        const normalized = input
            .map((entry: any, index: number) => {
                const url = String(entry?.url || '').trim();
                const previewUrl = String(entry?.previewUrl || entry?.url || '').trim();
                if (!url && !previewUrl) return null;
                const source = String(entry?.source || '').trim().toLowerCase() || 'external';
                const id = String(entry?.key || url || previewUrl || entry?.id || `candidate-${index + 1}`).trim();
                const score = Number(entry?.score);
                const confidence = Number(entry?.confidence);
                return {
                    id,
                    url: url || previewUrl,
                    previewUrl: previewUrl || url,
                    key: String(entry?.key || '').trim() || null,
                    title: String(entry?.title || '').trim() || null,
                    source,
                    provider: String(entry?.provider || entry?.source || '').trim() || null,
                    domain: String(entry?.domain || '').trim() || null,
                    score: Number.isFinite(score) ? score : null,
                    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
                    reason: String(entry?.reason || '').trim() || null,
                    recommended: !!entry?.recommended
                } satisfies SmartProductImageCandidate;
            })
            .filter(Boolean) as SmartProductImageCandidate[];
        return normalized.slice(0, 6);
    };

    const mapParsedProducts = (data: any) => {
        if (!data || !Array.isArray(data.products)) return [];
        return data.products.map((p: any) => ({
            id: makeId(),
            name: p.name || 'Produto sem nome',
            brand: p.brand || '',
            productCode: p.productCode || null,
            weight: p.weight || '',
            // Preço principal (legado - mantido para compatibilidade)
            price: p.price || '',
            // Novos campos de preço por embalagem/unidade
            pricePack: p.pricePack ?? '',
            priceUnit: p.priceUnit ?? '',
            // Preços especiais/promocionais
            priceSpecial: p.priceSpecial ?? '',
            priceSpecialUnit: p.priceSpecialUnit ?? '',
            specialCondition: p.specialCondition ?? '',
            // Wholesale (legado)
            priceWholesale: p.priceWholesale ?? '',
            wholesaleTrigger: p.wholesaleTrigger ?? null,
            wholesaleTriggerUnit: p.wholesaleTriggerUnit ?? '',
            // Metadata de embalagem
            packQuantity: p.packQuantity ?? null,
            packUnit: p.packUnit ?? '',
            packageLabel: p.packageLabel ?? '',
            // Outros
            price_mode: p.price_mode || 'retail',
            limit: p.limit || '',
            flavor: p.flavor || '',
            imageUrl: null, // Start without image
            status: 'pending',
            imageDecisionReason: '',
            raw: p
        })) as SmartProduct[];
    };

    const isExpectedNoImageError = (err: any): boolean => {
        const status = Number(
            err?.statusCode ??
            err?.status ??
            err?.response?.status ??
            err?.data?.statusCode
        );
        return status === 404;
    };

    const extractErrorMessage = (err: any, fallback: string): string => {
        const msg = String(
            err?.data?.message ||
            err?.data?.statusMessage ||
            err?.statusMessage ||
            err?.message ||
            fallback
        ).trim();
        return msg.length ? msg : fallback;
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const getHttpStatus = (err: any): number => {
        const status = Number(
            err?.statusCode ??
            err?.status ??
            err?.response?.status ??
            err?.data?.statusCode
        );
        return Number.isFinite(status) ? status : 0;
    };

    const getRetryAfterMs = (err: any): number => {
        // h3 enforceRateLimit sets Retry-After (seconds)
        const headers = err?.response?.headers;
        let raw: any = undefined;
        try {
            if (headers && typeof headers.get === 'function') {
                raw = headers.get('Retry-After') ?? headers.get('retry-after');
            } else if (headers && typeof headers === 'object') {
                raw = (headers as any)['retry-after'] ?? (headers as any)['Retry-After'];
            }
        } catch {
            raw = undefined;
        }
        const seconds = Number(String(raw ?? '').trim());
        if (!Number.isFinite(seconds) || seconds <= 0) return 0;
        return Math.max(500, Math.round(seconds * 1000));
    };

    const isRateLimitError = (err: any): boolean => getHttpStatus(err) === 429;
    const isTransientNetworkError = (err: any): boolean => {
        const status = getHttpStatus(err);
        if (status === 0) {
            const msg = String(
                err?.message ||
                err?.statusMessage ||
                err?.data?.message ||
                err?.cause?.message ||
                ''
            ).toLowerCase();
            if (
                msg.includes('failed to fetch') ||
                msg.includes('network changed') ||
                msg.includes('networkerror') ||
                msg.includes('<no response>') ||
                msg.includes('load failed')
            ) return true;
        }
        return status === 408 || status === 502 || status === 503 || status === 504;
    };

    const getParseFailureMessage = (err: any, kind: 'text' | 'file'): string => {
        const status = getHttpStatus(err);
        if (status === 429) {
            return 'Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.';
        }
        if (status === 413) {
            return 'O arquivo enviado é grande demais para processamento.';
        }
        if (status === 422) {
            return extractErrorMessage(
                err,
                kind === 'file'
                    ? 'Nao foi possivel analisar o arquivo enviado.'
                    : 'Nao foi possivel analisar o texto enviado.'
            );
        }
        if (status === 504) {
            return kind === 'file'
                ? 'O parse demorou alem do limite do servidor. Tente um arquivo menor ou cole o texto.'
                : 'O parse demorou alem do limite do servidor. Tente dividir o texto em blocos menores.';
        }
        if (isTransientNetworkError(err)) {
            return kind === 'file'
                ? 'Conexao com o servidor oscilou durante o envio do arquivo. Tente novamente em alguns segundos.'
                : 'Conexao com o servidor oscilou durante o parse. Tente novamente em alguns segundos.';
        }
        return extractErrorMessage(
            err,
            kind === 'file' ? 'Falha ao processar arquivo' : 'Falha ao processar texto'
        );
    };

    const fetchParseProducts = async (body: any) => {
        const headers = await getApiAuthHeaders();
        let lastErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await $fetch('/api/parse-products', {
                    method: 'POST',
                    headers,
                    body,
                    timeout: 70_000
                });
            } catch (err: any) {
                lastErr = err;
                if (!isTransientNetworkError(err) || attempt === 1) throw err;
                await sleep(1500);
            }
        }
        throw lastErr || new Error('Falha ao processar produtos');
    };

    const CHUNK_LIMIT = 15_000;

    const splitTextIntoChunks = (text: string): string[] => {
        const trimmed = text.trim();
        if (trimmed.length <= CHUNK_LIMIT) return [trimmed];
        const lines = trimmed.split(/\r?\n/);
        const chunks: string[] = [];
        let current = '';
        for (const line of lines) {
            if (current.length + line.length + 1 > CHUNK_LIMIT && current.length > 0) {
                chunks.push(current);
                current = line;
            } else {
                current = current ? current + '\n' + line : line;
            }
        }
        if (current) chunks.push(current);
        return chunks;
    };

    const parseText = async (text: string) => {
        isParsing.value = true;
        parsingError.value = null;
        products.value = [];

        try {
            const chunks = splitTextIntoChunks(text);
            if (chunks.length <= 1) {
                const data = await fetchParseProducts({ text });
                products.value = mapParsedProducts(data);
            } else {
                const allProducts: any[] = [];
                for (const chunk of chunks) {
                    try {
                        const data = await fetchParseProducts({ text: chunk });
                        const mapped = mapParsedProducts(data);
                        allProducts.push(...mapped);
                    } catch (chunkErr: any) {
                        console.warn('[parseText] Chunk parse failed, continuing:', chunkErr?.message);
                    }
                }
                products.value = allProducts;
            }
        } catch (err: any) {
            console.error(err);
            parsingError.value = getParseFailureMessage(err, 'text');
        } finally {
            isParsing.value = false;
        }
    }

    const parseFile = async (file: File) => {
        isParsing.value = true;
        parsingError.value = null;
        products.value = [];

        try {
            const form = new FormData();
            form.append('file', file);
            const data = await fetchParseProducts(form);
            products.value = mapParsedProducts(data);
        } catch (err: any) {
            console.error(err);
            parsingError.value = getParseFailureMessage(err, 'file');
        } finally {
            isParsing.value = false;
        }
    };

    const processProductImage = async (
        index: number,
        options: ImageProcessOptions = {}
    ): Promise<ImageProcessResult> => {
        const product = products.value[index];
        if (!product || product.status === 'processing') return { ok: false };
        if (!options.force && product.imageUrl) {
            product.status = 'done';
            product.error = undefined;
            product.imageProvider = String(product.imageProvider || product.imageSource || 'fallback').trim() || undefined;
            product.imageAttemptCount = Number.isFinite(Number(product.imageAttemptCount)) ? Number(product.imageAttemptCount) : 0;
            product.imageCandidateCount = Number.isFinite(Number(product.imageCandidateCount)) ? Number(product.imageCandidateCount) : 0;
            product.imageConfidence = Number.isFinite(Number(product.imageConfidence)) ? Number(product.imageConfidence) : (product.imageSource === 'manual' ? 1 : product.imageConfidence);
            product.imageDecision = 'approved';
            product.imageCandidates = Array.isArray(product.imageCandidates) ? product.imageCandidates : [];
            return { ok: true };
        }

        product.status = 'processing';
        product.error = undefined;
        product.imageSource = 'fallback';
        if (options.force) {
            product.imageUrl = null;
        }
        product.imageConfidence = undefined;
        product.imageReviewReason = '';
        product.imageDecisionReason = '';
        product.imageProvider = undefined;
        product.imageAttemptCount = undefined;
        product.imageCandidateCount = undefined;
        product.imageDecision = undefined;
        product.imageCandidates = [];

        try {
            // Priorizar gramatura encontrada no nome completo (mais confiável que parser isolado).
            const weightFromName = extractWeightFromName(product.name);
            const explicitWeight = product.weight ? normalizeWeightToken(product.weight) : null;
            const effectiveWeight = weightFromName || explicitWeight || undefined;
            const searchTerm = buildSearchTerm(product, effectiveWeight);
            const searchHints = buildSearchHintCandidates(product, effectiveWeight);
            const headers = await getApiAuthHeaders();

            const result = await $fetch<{
                url?: string;
                found?: boolean;
                reviewPending?: boolean;
                reason?: string;
                statusMessage?: string;
                message?: string;
                source?: string;
                imageSource?: SmartProduct['imageSource'];
                confidence?: number;
                provider?: string;
                candidateCount?: number;
                attempts?: number;
                nextAction?: string;
                imageReviewReason?: string;
                decision?: 'approved' | 'ambiguous' | 'blocked';
                candidates?: SmartProductImageCandidate[];
            }>('/api/process-product-image', {
                method: 'POST',
                headers,
                body: {
                    term: searchTerm,
                    searchHints,
                    productCode: product.productCode || undefined,
                    brand: product.brand || undefined,
                    flavor: product.flavor || undefined,
                    weight: effectiveWeight,
                    bgPolicy: options.bgPolicy || 'auto',
                    matchMode: options.matchMode || 'precise',
                    strictMode: (options.matchMode || 'precise') === 'precise',
                    selectedCandidate: options.selectedCandidate || undefined
                }
            });

            const normalizedCandidates = normalizeSmartProductCandidates(result?.candidates);

            if (result && result.url) {
                product.imageUrl = toWasabiDirectUrl(String(result.url || '').trim()) || result.url;
                product.status = 'done';
                product.imageDecisionReason = '';
                product.imageReviewReason = '';
                const resolvedSource = normalizeImageSource(result.imageSource || result.source);
                product.imageSource = resolvedSource;
                product.imageProvider = String(result.provider || result.imageSource || result.source || 'ai').trim() || undefined;
                const confidence = Number(result.confidence);
                product.imageConfidence = Number.isFinite(confidence)
                    ? Math.max(0, Math.min(1, confidence))
                    : undefined;
                const candidateCount = Number(result.candidateCount);
                product.imageCandidateCount = Number.isFinite(candidateCount) ? Math.max(0, candidateCount) : undefined;
                const attemptCount = Number(result.attempts);
                product.imageAttemptCount = Number.isFinite(attemptCount) ? Math.max(0, attemptCount) : undefined;
                product.imageDecision = 'approved';
                product.imageCandidates = normalizedCandidates;
                console.log('[ProductProcessor] Image found:', product.name, result.url.substring(0, 80) + '...');
                return {
                    ok: true,
                    reviewPending: false,
                    decision: 'approved',
                    confidence: product.imageConfidence,
                    source: String(result.source || ''),
                    imageProvider: product.imageProvider,
                    candidateCount: Number(result.candidateCount || 0),
                    attempts: Number(result.attempts || 0),
                    candidates: normalizedCandidates
                };
            } else {
                const rawReason = String(result?.reason || '').trim();
                const reason = rawReason === 'processing_failed'
                    ? String(result?.message || result?.statusMessage || rawReason || 'Falha no processamento da imagem')
                    : String(result?.message || result?.statusMessage || rawReason || 'Imagem não encontrada');
                const isReviewPending = !!result?.reviewPending;
                product.status = isReviewPending ? 'review_pending' : 'error';
                product.error = reason;
                const reviewReason = String(result?.imageReviewReason || result?.reason || reason).trim();
                product.imageDecisionReason = reviewReason;
                product.imageReviewReason = reviewReason;
                product.imageSource = normalizeImageSource(result.imageSource || result.source);
                product.imageProvider = String(result.provider || result.imageSource || result.source || 'ai').trim() || undefined;
                const confidence = Number(result.confidence);
                product.imageConfidence = Number.isFinite(confidence)
                    ? Math.max(0, Math.min(1, confidence))
                    : 0;
                const candidateCount = Number(result.candidateCount);
                product.imageCandidateCount = Number.isFinite(candidateCount) ? Math.max(0, candidateCount) : 0;
                const attemptCount = Number(result.attempts);
                product.imageAttemptCount = Number.isFinite(attemptCount) ? Math.max(0, attemptCount) : 0;
                product.imageCandidates = normalizedCandidates;
                product.imageDecision = result?.decision
                    ? result.decision
                    : (normalizedCandidates.length > 0 ? 'ambiguous' : 'blocked');
                if (result.nextAction && String(result.nextAction || '').trim()) {
                    product.imageReviewReason = String(result.nextAction || '').trim();
                    product.imageDecisionReason = product.imageReviewReason;
                }
                product.error = reviewReason || reason;
                console.log('[ProductProcessor] No image found for:', product.name, '-', product.error);
                return {
                    ok: false,
                    reviewPending: isReviewPending,
                    decision: product.imageDecision,
                    source: String(result?.source || ''),
                    imageProvider: product.imageProvider,
                    confidence: product.imageConfidence,
                    candidateCount: Number(result?.candidateCount || 0),
                    attempts: Number(result?.attempts || 0),
                    nextAction: String(result?.nextAction || '').trim() || undefined,
                    candidates: normalizedCandidates
                };
            }
        } catch (err: any) {
            const isRetryableFailure = isRateLimitError(err) || isTransientNetworkError(err);
            if (isRetryableFailure) {
                const retryAfterMs = getRetryAfterMs(err) || 3000;
                const previousRetryCount = Number.isFinite(Number(product.imageAttemptCount)) ? Number(product.imageAttemptCount) : 0;
                product.status = 'pending';
                product.error = isRateLimitError(err)
                    ? `Rate limit: aguardando ${Math.ceil(retryAfterMs / 1000)}s para tentar novamente...`
                    : `Rede instável: aguardando ${Math.ceil(retryAfterMs / 1000)}s para tentar novamente...`;
                product.imageSource = 'fallback';
                product.imageProvider = 'network';
                product.imageConfidence = 0;
                product.imageCandidateCount = 0;
                product.imageAttemptCount = Math.max(1, previousRetryCount + 1);
                product.imageDecisionReason = product.imageReviewReason = product.error;
                product.imageDecision = 'blocked';
                product.imageCandidates = [];
                return { ok: false, rateLimited: true, retryAfterMs, reviewPending: false, imageProvider: product.imageProvider };
            }
            if (isExpectedNoImageError(err)) {
                const noImageMessage = extractErrorMessage(err, 'Imagem não encontrada');
                product.status = 'error';
                product.error = noImageMessage;
                product.imageDecisionReason = noImageMessage;
                product.imageReviewReason = noImageMessage;
                product.imageConfidence = 0;
                product.imageSource = 'fallback';
                product.imageProvider = 'registry';
                product.imageCandidateCount = 0;
                product.imageAttemptCount = 0;
                product.imageDecision = 'blocked';
                product.imageCandidates = [];
                console.warn('[ProductProcessor] Imagem não encontrada:', product.name, '-', noImageMessage);
                return { ok: false, reviewPending: false, imageProvider: product.imageProvider };
            }

            console.error('[ProductProcessor] Falha ao processar imagem:', product.name, err);
            product.status = 'error';
            product.error = extractErrorMessage(err, 'Falha no processamento');
            product.imageDecisionReason = product.error;
            product.imageReviewReason = product.error;
            product.imageConfidence = 0;
            product.imageSource = 'fallback';
            product.imageProvider = 'server';
            product.imageCandidateCount = 0;
            product.imageAttemptCount = 0;
            product.imageDecision = 'blocked';
            product.imageCandidates = [];
            return { ok: false, reviewPending: false, imageProvider: product.imageProvider };
        }
    }

    const applyImageCandidate = async (
        index: number,
        candidate: SmartProductImageCandidate,
        options: { bgPolicy?: BgPolicy; matchMode?: ImageMatchMode } = {}
    ): Promise<ImageProcessResult> => {
        return await processProductImage(index, {
            bgPolicy: options.bgPolicy || 'auto',
            matchMode: options.matchMode || 'precise',
            force: true,
            selectedCandidate: candidate
        });
    };

    const processAllImages = async (
        options: {
            bgPolicy?: BgPolicy;
            matchMode?: ImageMatchMode;
            concurrency?: number;
            force?: boolean;
        } = {}
    ) => {
        const runId = ++processingRunId.value;
        const mode: ImageMatchMode = options.matchMode || 'precise';
        const force = !!options.force;
        const concurrency = Math.min(8, Math.max(1, Number(options.concurrency || 4)));
        const resolvedBySignature = new Map<string, {
            imageUrl: string;
            imageSource?: SmartProduct['imageSource'];
            imageConfidence?: number;
            imageProvider?: string;
            imageCandidateCount?: number;
            imageAttemptCount?: number;
            imageDecisionReason?: string;
            imageReviewReason?: string;
            imageDecision?: SmartProduct['imageDecision'];
            imageCandidates?: SmartProductImageCandidate[];
        }>();

        const writeResolvedSignature = (signature: string, sourceProduct: SmartProduct) => {
            if (!sourceProduct.imageUrl) return;
            resolvedBySignature.set(signature, {
                imageUrl: sourceProduct.imageUrl,
                imageSource: sourceProduct.imageSource,
                imageConfidence: sourceProduct.imageConfidence,
                imageProvider: sourceProduct.imageProvider,
                imageCandidateCount: sourceProduct.imageCandidateCount,
                imageAttemptCount: sourceProduct.imageAttemptCount,
                imageDecisionReason: sourceProduct.imageDecisionReason,
                imageReviewReason: sourceProduct.imageReviewReason,
                imageDecision: sourceProduct.imageDecision,
                imageCandidates: Array.isArray(sourceProduct.imageCandidates)
                    ? JSON.parse(JSON.stringify(sourceProduct.imageCandidates))
                    : []
            });
        };

        const applyResolvedDuplicateState = (target: SmartProduct, sourceState: any) => {
            target.imageUrl = sourceState.imageUrl;
            target.status = sourceState.imageUrl ? 'done' : target.status;
            target.error = sourceState.imageUrl ? undefined : target.error;
            target.imageSource = sourceState.imageSource;
            target.imageConfidence = sourceState.imageConfidence;
            target.imageProvider = sourceState.imageProvider;
            target.imageCandidateCount = sourceState.imageCandidateCount;
            target.imageAttemptCount = sourceState.imageAttemptCount;
            target.imageDecisionReason = sourceState.imageDecisionReason;
            target.imageReviewReason = sourceState.imageReviewReason;
            target.imageDecision = sourceState.imageDecision;
            target.imageCandidates = Array.isArray(sourceState.imageCandidates)
                ? JSON.parse(JSON.stringify(sourceState.imageCandidates))
                : [];
        };

        imageQueueState.value = {
            total: 0,
            done: 0,
            failed: 0,
            retrying: 0,
            inFlight: 0,
            running: true,
            paused: false,
            cancelled: false
        };

        console.log('[ProductProcessor] processAllImages called, products:', products.value.length);
        
        // ===== DEDUPLICAÇÃO: agrupar produtos com mesmo search term normalizado =====
        const dedupMap = new Map<string, number[]>(); // normalizedKey → [indices]
        
        products.value.forEach((p, i) => {
            const signature = buildDedupSignature(p);
            if (!force && p.imageUrl) {
                writeResolvedSignature(signature, p);
                p.status = 'done';
                p.error = undefined;
                return;
            }
            if (p.status === 'processing') return;
            if (!force) {
                const resolvedImage = resolvedBySignature.get(signature);
                if (resolvedImage) {
                    applyResolvedDuplicateState(p, resolvedImage);
                    p.status = 'done';
                    p.error = undefined;
                    return;
                }
            }
            if (!dedupMap.has(signature)) {
                dedupMap.set(signature, []);
            }
            dedupMap.get(signature)!.push(i);
        });
        
        const uniqueGroups = Array.from(dedupMap.entries())
            .map(([signature, indices]) => ({ signature, indices: indices.filter((v) => Number.isInteger(v)) }))
            .filter((entry) => entry.indices.length > 0);
        console.log(`[ProductProcessor] ${products.value.length} produtos → ${uniqueGroups.length} buscas únicas (${products.value.length - uniqueGroups.length} duplicatas evitadas)`);
        imageQueueState.value.total = uniqueGroups.length;
        imageQueueState.value.done = 0;
        imageQueueState.value.failed = 0;
        imageQueueState.value.retrying = 0;

        let cursor = 0;
        const hasCancelled = () => runId !== processingRunId.value || imageQueueState.value.cancelled;
        const normalizeQueueProgressBounds = () => {
            const total = Math.max(0, Number(imageQueueState.value.total || 0));
            const done = Math.max(0, Number(imageQueueState.value.done || 0));
            imageQueueState.value.total = total;
            imageQueueState.value.done = total ? Math.min(total, done) : 0;
            imageQueueState.value.failed = Math.max(0, Number(imageQueueState.value.failed || 0));
            imageQueueState.value.retrying = Math.max(0, Number(imageQueueState.value.retrying || 0));
            imageQueueState.value.inFlight = Math.max(0, Math.min(total, Number(imageQueueState.value.inFlight || 0)));
        };
        const waitForRetryDelay = async (delayMs: number) => {
            let remaining = Math.max(0, Number(delayMs || 0));
            while (remaining > 0 && !hasCancelled()) {
                const step = Math.min(remaining, 250);
                await sleep(step);
                remaining -= step;
            }
        };
        const waitIfPaused = async () => {
            while (runId === processingRunId.value && imageQueueState.value.paused) {
                await sleep(250);
            }
        };

        const processWorker = async () => {
            while (!hasCancelled()) {
                await waitIfPaused();
                if (hasCancelled()) return;

                const item = uniqueGroups[cursor++];
                if (!item) return;
                const primaryIndexRaw = item.indices[0];
                if (!Number.isInteger(primaryIndexRaw)) continue;
                const primaryIndex = primaryIndexRaw as number;
                const signature = item.signature;
                const primaryProduct = products.value[primaryIndex];
                if (!primaryProduct) {
                    imageQueueState.value.done += 1;
                    continue;
                }

                imageQueueState.value.inFlight += 1;
                let attempts = 0;
                while (!hasCancelled() && attempts < 6) {
                    attempts += 1;
                    const res = await processProductImage(primaryIndex, {
                        bgPolicy: options.bgPolicy || 'auto',
                        matchMode: mode,
                        force: !!options.force
                    });

                    if (!res?.rateLimited) break;
                    imageQueueState.value.retrying += 1;
                    const retryDelayMs = Number(res?.retryAfterMs || 3000);
                    await waitForRetryDelay(retryDelayMs);
                    imageQueueState.value.retrying = Math.max(0, imageQueueState.value.retrying - 1);
                }
                imageQueueState.value.inFlight = Math.max(0, imageQueueState.value.inFlight - 1);

                if (hasCancelled()) {
                    if (primaryProduct.status === 'processing' || primaryProduct.status === 'pending') {
                        primaryProduct.status = 'pending';
                    }
                    continue;
                }

                // Replicar resultado para duplicatas
                if (item.indices.length > 1 && primaryProduct.imageUrl) {
                    writeResolvedSignature(signature, primaryProduct);
                    for (let i = 1; i < item.indices.length; i++) {
                        const duplicateIndexRaw = item.indices[i];
                        if (!Number.isInteger(duplicateIndexRaw)) continue;
                        const duplicateIndex = duplicateIndexRaw as number;
                        const dupProduct = products.value[duplicateIndex];
                        if (!dupProduct) continue;
                        dupProduct.imageUrl = primaryProduct.imageUrl;
                        dupProduct.status = 'done';
                        dupProduct.error = undefined;
                        dupProduct.imageDecisionReason = primaryProduct.imageDecisionReason;
                        dupProduct.imageReviewReason = primaryProduct.imageReviewReason;
                        dupProduct.imageSource = primaryProduct.imageSource;
                        dupProduct.imageConfidence = primaryProduct.imageConfidence;
                        dupProduct.imageProvider = primaryProduct.imageProvider;
                        dupProduct.imageCandidateCount = primaryProduct.imageCandidateCount;
                        dupProduct.imageAttemptCount = primaryProduct.imageAttemptCount;
                        dupProduct.imageDecision = primaryProduct.imageDecision;
                        dupProduct.imageCandidates = Array.isArray(primaryProduct.imageCandidates)
                            ? JSON.parse(JSON.stringify(primaryProduct.imageCandidates))
                            : [];
                        console.log(`[ProductProcessor] Replicado imagem para duplicata: ${dupProduct.name}`);
                    }
                } else if (item.indices.length > 1 && (primaryProduct.status === 'error' || primaryProduct.status === 'review_pending')) {
                    // Se falhou, marcar duplicatas como erro também
                    for (let i = 1; i < item.indices.length; i++) {
                        const duplicateIndexRaw = item.indices[i];
                        if (!Number.isInteger(duplicateIndexRaw)) continue;
                        const duplicateIndex = duplicateIndexRaw as number;
                        const dupProduct = products.value[duplicateIndex];
                        if (!dupProduct) continue;
                        dupProduct.status = primaryProduct.status;
                        dupProduct.imageUrl = null;
                        dupProduct.error = primaryProduct.error;
                        dupProduct.imageDecisionReason = primaryProduct.imageDecisionReason;
                        dupProduct.imageReviewReason = primaryProduct.imageReviewReason;
                        dupProduct.imageSource = primaryProduct.imageSource;
                        dupProduct.imageConfidence = primaryProduct.imageConfidence;
                        dupProduct.imageProvider = primaryProduct.imageProvider;
                        dupProduct.imageCandidateCount = primaryProduct.imageCandidateCount;
                        dupProduct.imageAttemptCount = primaryProduct.imageAttemptCount;
                        dupProduct.imageDecision = primaryProduct.imageDecision;
                        dupProduct.imageCandidates = Array.isArray(primaryProduct.imageCandidates)
                            ? JSON.parse(JSON.stringify(primaryProduct.imageCandidates))
                            : [];
                    }
                } else if (attempts >= 6 && primaryProduct.status === 'pending') {
                    primaryProduct.status = 'review_pending';
                    primaryProduct.error = primaryProduct.error || 'Falha temporária de comunicação com limite de tentativas. Reprocessar manualmente.';
                    if (!primaryProduct.imageReviewReason) {
                        primaryProduct.imageReviewReason = primaryProduct.error;
                    }
                    if (!primaryProduct.imageDecisionReason) {
                        primaryProduct.imageDecisionReason = primaryProduct.error;
                    }
                    primaryProduct.imageDecision = primaryProduct.imageCandidates?.length ? 'ambiguous' : 'blocked';
                    console.warn('[ProductProcessor] Retry esgotado para produto:', primaryProduct.name);
                }
                if (primaryProduct.status === 'error' || primaryProduct.status === 'review_pending') {
                    imageQueueState.value.failed += 1;
                }

                imageQueueState.value.done += 1;
            }
        };

        const workers = Array.from({ length: concurrency }, () => processWorker());
        await Promise.all(workers);
        if (runId !== processingRunId.value) {
            return;
        }
        imageQueueState.value.running = false;
        imageQueueState.value.paused = false;
        imageQueueState.value.inFlight = 0;
        imageQueueState.value.cancelled = false;
        imageQueueState.value.retrying = 0;
        normalizeQueueProgressBounds();
    }

    const cancelImageProcessing = () => {
        imageQueueState.value.cancelled = true;
        imageQueueState.value.running = false;
        imageQueueState.value.paused = false;
        imageQueueState.value.inFlight = 0;
        imageQueueState.value.retrying = 0;
        processingRunId.value += 1;
    };

    const pauseImageProcessing = () => {
        if (!imageQueueState.value.running) return;
        imageQueueState.value.paused = true;
    };

    const resumeImageProcessing = () => {
        if (!imageQueueState.value.running) return;
        imageQueueState.value.paused = false;
    };

    const resetImageProcessingState = () => {
        imageQueueState.value = createInitialImageQueueState();
    };

    const isImageProcessing = computed(() => imageQueueState.value.running);
    const imageQueueStateSnapshot = computed(() => imageQueueState.value);

    const removeProduct = (index: number) => {
        products.value.splice(index, 1);
    }

    return {
        products,
        isParsing,
        parsingError,
        parseText,
        parseFile,
        processProductImage,
        applyImageCandidate,
        processAllImages,
        imageQueueState: imageQueueStateSnapshot,
        isImageProcessing,
        pauseImageProcessing,
        resumeImageProcessing,
        cancelImageProcessing,
        resetImageProcessingState,
        removeProduct
    }
}
