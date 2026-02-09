export interface SmartProduct {
    id: string;
    name: string;
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
    status: 'pending' | 'processing' | 'done' | 'error';
    error?: string;
    // Original extracted data
    raw?: any;
}

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

// Monta search term a partir do produto
const buildSearchTerm = (product: SmartProduct, effectiveWeight?: string | null): string => {
    const name = String(product.name || '').trim();
    const parts = [name];
    if (product.brand) parts.push(product.brand);
    if (product.flavor && !['sabores', 'fragrâncias', 'fragancias', 'variados', 'sortidos', 'diversos'].includes(product.flavor.toLowerCase())) {
        parts.push(product.flavor);
    }
    const weightToUse = effectiveWeight || product.weight || null;
    if (weightToUse) {
        const normalizedName = normalizeForDedup(name);
        const normalizedWeight = normalizeForDedup(String(weightToUse));
        if (!normalizedWeight || !normalizedName.includes(normalizedWeight)) {
            parts.push(weightToUse);
        }
    }
    return parts.join(' ').trim();
};

const buildDedupSignature = (product: SmartProduct): string => {
    const effectiveWeight = extractWeightFromName(product.name) || (product.weight ? normalizeWeightToken(product.weight) : '') || '';
    const signatureParts = [
        product.name || '',
        product.brand || '',
        product.flavor || '',
        effectiveWeight
    ].filter(Boolean);
    return normalizeForDedup(signatureParts.join(' ').trim());
};

export const useProductProcessor = () => {
    const supabase = useSupabase();
    const products = ref<SmartProduct[]>([]);
    const isParsing = ref(false);
    const parsingError = ref<string | null>(null);

    const getApiAuthHeaders = async () => {
        const { data, error } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (error || !token) {
            throw new Error('Sessão expirada. Faça login novamente.');
        }
        return { Authorization: `Bearer ${token}` };
    };

    const mapParsedProducts = (data: any) => {
        if (!data || !Array.isArray(data.products)) return [];
        return data.products.map((p: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: p.name || 'Produto sem nome',
            brand: p.brand || '',
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
            raw: p
        })) as SmartProduct[];
    };

    const parseText = async (text: string) => {
        isParsing.value = true;
        parsingError.value = null;
        products.value = [];

        try {
            const headers = await getApiAuthHeaders();
            const data = await $fetch('/api/parse-products', {
                method: 'POST',
                headers,
                body: { text }
            });
            products.value = mapParsedProducts(data);
        } catch (err: any) {
            console.error(err);
            parsingError.value = err.message || 'Falha ao processar texto';
        } finally {
            isParsing.value = false;
        }
    }

    const parseFile = async (file: File) => {
        isParsing.value = true;
        parsingError.value = null;
        products.value = [];

        try {
            const headers = await getApiAuthHeaders();
            const form = new FormData();
            form.append('file', file);
            const data = await $fetch('/api/parse-products', {
                method: 'POST',
                headers,
                body: form
            });
            products.value = mapParsedProducts(data);
        } catch (err: any) {
            console.error(err);
            parsingError.value = err.message || 'Falha ao processar arquivo';
        } finally {
            isParsing.value = false;
        }
    };

    const processProductImage = async (index: number) => {
        const product = products.value[index];
        if (!product || product.status === 'processing') return;

        product.status = 'processing';
        product.error = undefined;

        try {
            // Priorizar gramatura encontrada no nome completo (mais confiável que parser isolado).
            const weightFromName = extractWeightFromName(product.name);
            const explicitWeight = product.weight ? normalizeWeightToken(product.weight) : null;
            const effectiveWeight = weightFromName || explicitWeight || undefined;
            const searchTerm = buildSearchTerm(product, effectiveWeight);
            const headers = await getApiAuthHeaders();
            
            const result = await $fetch('/api/process-product-image', {
                method: 'POST',
                headers,
                body: {
                    term: searchTerm,
                    brand: product.brand || undefined,
                    flavor: product.flavor || undefined,
                    weight: effectiveWeight
                }
            });

            if (result && result.url) {
                product.imageUrl = result.url;
                product.status = 'done';
                console.log('[ProductProcessor] Image found:', product.name, result.url.substring(0, 80) + '...');
            } else {
                product.status = 'error';
                product.error = 'Imagem não encontrada';
                console.log('[ProductProcessor] No image found for:', product.name);
            }
        } catch (err: any) {
            console.error(err);
            product.status = 'error';
            product.error = 'Falha no processamento';
        }
    }

    const processAllImages = async () => {
        console.log('[ProductProcessor] processAllImages called, products:', products.value.length);
        
        // ===== DEDUPLICAÇÃO: agrupar produtos com mesmo search term normalizado =====
        const dedupMap = new Map<string, number[]>(); // normalizedKey → [indices]
        
        products.value.forEach((p, i) => {
            if (p.imageUrl || p.status === 'processing') return;
            const signature = buildDedupSignature(p);
            if (!dedupMap.has(signature)) {
                dedupMap.set(signature, []);
            }
            dedupMap.get(signature)!.push(i);
        });
        
        const uniqueGroups = Array.from(dedupMap.entries());
        console.log(`[ProductProcessor] ${products.value.length} produtos → ${uniqueGroups.length} buscas únicas (${products.value.length - uniqueGroups.length} duplicatas evitadas)`);
        
        // Processar apenas o primeiro de cada grupo, depois replicar para os demais
        for (const [signature, indices] of uniqueGroups) {
            const primaryIndex = indices[0];
            if (primaryIndex === undefined) continue;
            const primaryProduct = products.value[primaryIndex];
            if (!primaryProduct) continue;
            console.log(`[ProductProcessor] Processing: ${primaryProduct.name} (${indices.length} duplicata(s), assinatura="${signature}")`);
            
            await processProductImage(primaryIndex);
            
            // Replicar resultado para duplicatas
            if (indices.length > 1 && primaryProduct.imageUrl) {
                for (let i = 1; i < indices.length; i++) {
                    const duplicateIndex = indices[i];
                    if (duplicateIndex === undefined) continue;
                    const dupProduct = products.value[duplicateIndex];
                    if (!dupProduct) continue;
                    dupProduct.imageUrl = primaryProduct.imageUrl;
                    dupProduct.status = 'done';
                    console.log(`[ProductProcessor] Replicado imagem para duplicata: ${dupProduct.name}`);
                }
            } else if (indices.length > 1 && primaryProduct.status === 'error') {
                // Se falhou, marcar duplicatas como erro também
                for (let i = 1; i < indices.length; i++) {
                    const duplicateIndex = indices[i];
                    if (duplicateIndex === undefined) continue;
                    const dupProduct = products.value[duplicateIndex];
                    if (!dupProduct) continue;
                    dupProduct.status = 'error';
                    dupProduct.error = primaryProduct.error;
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
