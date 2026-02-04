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

export const useProductProcessor = () => {
    const products = ref<SmartProduct[]>([]);
    const isParsing = ref(false);
    const parsingError = ref<string | null>(null);

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
            const data = await $fetch('/api/parse-products', {
                method: 'POST',
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
            const form = new FormData();
            form.append('file', file);
            const data = await $fetch('/api/parse-products', {
                method: 'POST',
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
            // Construct a rich search term
            const searchTerm = `${product.name} ${product.brand || ''} ${product.flavor || ''} ${product.weight || ''}`.trim();
            
            const result = await $fetch('/api/process-product-image', {
                method: 'POST',
                body: { term: searchTerm }
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
        
        // Process sequentially or parallel? Parallel might hit rate limits.
        // Let's do a pool of 3
        const queue = products.value
            .map((p, i) => ({ index: i, product: p }))
            .filter(item => !item.product.imageUrl && item.product.status !== 'processing');
        
        console.log('[ProductProcessor] Queue size:', queue.length);
            
        // Simple sequential for MVP robustness
        for (const item of queue) {
            console.log('[ProductProcessor] Processing:', item.product.name);
            await processProductImage(item.index);
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
