import { toWasabiProxyUrl } from '~/utils/storageProxy';

export interface SmartProduct {
    id: string;
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
    // Original extracted data
    raw?: any;
}

type BgPolicy = 'auto' | 'never' | 'always';

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
    // Deduplicar preservando ordem (evita colidir termos distintos com mesmos tokens em ordem diferente)
    const seen = new Set<string>();
    const ordered = words.filter((w) => {
        if (seen.has(w)) return false;
        seen.add(w);
        return true;
    });
    return ordered.join(' ');
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

    const mapParsedProducts = (data: any) => {
        if (!data || !Array.isArray(data.products)) return [];
        return data.products.map((p: any) => ({
            id: Math.random().toString(36).substr(2, 9),
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
        return status === 502 || status === 503 || status === 504;
    };

    const fetchParseProducts = async (body: any) => {
        const headers = await getApiAuthHeaders();
        let lastErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                return await $fetch('/api/parse-products', {
                    method: 'POST',
                    headers,
                    body
                });
            } catch (err: any) {
                lastErr = err;
                if (!isTransientNetworkError(err) || attempt === 2) throw err;
                const waitMs = 600 * (attempt + 1);
                await sleep(waitMs);
            }
        }
        throw lastErr || new Error('Falha ao processar produtos');
    };

    const parseText = async (text: string) => {
        isParsing.value = true;
        parsingError.value = null;
        products.value = [];

        try {
            const data = await fetchParseProducts({ text });
            products.value = mapParsedProducts(data);
        } catch (err: any) {
            console.error(err);
            parsingError.value = isTransientNetworkError(err)
                ? 'Conexão com o servidor oscilou durante o parse. Tente novamente em alguns segundos.'
                : (err.message || 'Falha ao processar texto');
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
            parsingError.value = isTransientNetworkError(err)
                ? 'Conexão com o servidor oscilou durante o envio do arquivo. Tente novamente em alguns segundos.'
                : (err.message || 'Falha ao processar arquivo');
        } finally {
            isParsing.value = false;
        }
    };

    const processProductImage = async (
        index: number,
        options: { bgPolicy?: BgPolicy; force?: boolean } = {}
    ): Promise<{ ok: boolean; rateLimited?: boolean; retryAfterMs?: number }> => {
        const product = products.value[index];
        if (!product || product.status === 'processing') return { ok: false };
        if (!options.force && product.imageUrl) {
            product.status = 'done';
            product.error = undefined;
            return { ok: true };
        }

        product.status = 'processing';
        product.error = undefined;

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
                    strictMode: true
                }
            });

            if (result && result.url) {
                product.imageUrl = toWasabiProxyUrl(String(result.url || '').trim()) || result.url;
                product.status = 'done';
                product.imageDecisionReason = '';
                console.log('[ProductProcessor] Image found:', product.name, result.url.substring(0, 80) + '...');
                return { ok: true };
            } else {
                const reason = String(result?.reason || result?.statusMessage || result?.message || 'Imagem não encontrada');
                const isReviewPending = !!result?.reviewPending;
                product.status = isReviewPending ? 'review_pending' : 'error';
                product.error = reason;
                product.imageDecisionReason = reason;
                console.log('[ProductProcessor] No image found for:', product.name, '-', product.error);
                return { ok: false };
            }
        } catch (err: any) {
            if (isRateLimitError(err)) {
                const retryAfterMs = getRetryAfterMs(err) || 3000;
                product.status = 'pending';
                product.error = `Rate limit: aguardando ${Math.ceil(retryAfterMs / 1000)}s para tentar novamente...`;
                return { ok: false, rateLimited: true, retryAfterMs };
            }
            if (isExpectedNoImageError(err)) {
                const noImageMessage = extractErrorMessage(err, 'Imagem não encontrada');
                product.status = 'error';
                product.error = noImageMessage;
                product.imageDecisionReason = noImageMessage;
                console.warn('[ProductProcessor] Imagem não encontrada:', product.name, '-', noImageMessage);
                return { ok: false };
            }

            console.error('[ProductProcessor] Falha ao processar imagem:', product.name, err);
            product.status = 'error';
            product.error = extractErrorMessage(err, 'Falha no processamento');
            product.imageDecisionReason = product.error;
            return { ok: false };
        }
    }

    const processAllImages = async (options: { bgPolicy?: BgPolicy } = {}) => {
        console.log('[ProductProcessor] processAllImages called, products:', products.value.length);
        const resolvedBySignature = new Map<string, string>();
        
        // ===== DEDUPLICAÇÃO: agrupar produtos com mesmo search term normalizado =====
        const dedupMap = new Map<string, number[]>(); // normalizedKey → [indices]
        
        products.value.forEach((p, i) => {
            const signature = buildDedupSignature(p);
            if (p.imageUrl) {
                resolvedBySignature.set(signature, p.imageUrl);
                p.status = 'done';
                p.error = undefined;
                return;
            }
            if (p.status === 'processing') return;
            const resolvedImage = resolvedBySignature.get(signature);
            if (resolvedImage) {
                p.imageUrl = resolvedImage;
                p.status = 'done';
                p.error = undefined;
                return;
            }
            if (!dedupMap.has(signature)) {
                dedupMap.set(signature, []);
            }
            dedupMap.get(signature)!.push(i);
        });
        
        const uniqueGroups = Array.from(dedupMap.entries());
        console.log(`[ProductProcessor] ${products.value.length} produtos → ${uniqueGroups.length} buscas únicas (${products.value.length - uniqueGroups.length} duplicatas evitadas)`);
        
        // Processar apenas o primeiro de cada grupo, depois replicar para os demais.
        // Se bater rate-limit (429), aguarda Retry-After e tenta novamente automaticamente.
        for (const [signature, indices] of uniqueGroups) {
            const primaryIndex = indices[0];
            if (primaryIndex === undefined) continue;
            const primaryProduct = products.value[primaryIndex];
            if (!primaryProduct) continue;
            console.log(`[ProductProcessor] Processing: ${primaryProduct.name} (${indices.length} duplicata(s), assinatura="${signature}")`);

            let attempts = 0;
            while (attempts < 6) {
                attempts += 1;
                const res = await processProductImage(primaryIndex, { bgPolicy: options.bgPolicy || 'auto' });
                if (!res?.rateLimited) break;
                const waitMs = Math.max(800, Number(res.retryAfterMs || 0) || 3000);
                await sleep(waitMs);
            }
            
            // Replicar resultado para duplicatas
            if (indices.length > 1 && primaryProduct.imageUrl) {
                resolvedBySignature.set(signature, primaryProduct.imageUrl);
                for (let i = 1; i < indices.length; i++) {
                    const duplicateIndex = indices[i];
                    if (duplicateIndex === undefined) continue;
                    const dupProduct = products.value[duplicateIndex];
                    if (!dupProduct) continue;
                    dupProduct.imageUrl = primaryProduct.imageUrl;
                    dupProduct.status = 'done';
                    console.log(`[ProductProcessor] Replicado imagem para duplicata: ${dupProduct.name}`);
                }
            } else if (indices.length > 1 && (primaryProduct.status === 'error' || primaryProduct.status === 'review_pending')) {
                // Se falhou, marcar duplicatas como erro também
                for (let i = 1; i < indices.length; i++) {
                    const duplicateIndex = indices[i];
                    if (duplicateIndex === undefined) continue;
                    const dupProduct = products.value[duplicateIndex];
                    if (!dupProduct) continue;
                    dupProduct.status = primaryProduct.status;
                    dupProduct.error = primaryProduct.error;
                    dupProduct.imageDecisionReason = primaryProduct.imageDecisionReason;
                }
            }
        }
    }

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
        processAllImages,
        removeProduct
    }
}
