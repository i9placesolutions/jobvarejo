import { ListObjectsV2Command, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { processImage, downloadImage } from "../utils/image-processor";
import { createSupabaseAdmin } from "../utils/supabase";
import { createHash } from 'crypto';

/** Build a same-origin proxy URL for a given S3 key (avoids CORS + no expiration) */
const proxyUrl = (key: string) => `/api/storage/proxy?key=${encodeURIComponent(key)}`;

// ========================================
// Normalização avançada de search term
// ========================================
const UNIT_MAP: Record<string, string> = {
    mililitros: 'ml', mililitro: 'ml', mls: 'ml',
    gramas: 'g', grama: 'g', gs: 'g',
    quilos: 'kg', quilo: 'kg', quilogramas: 'kg', quilograma: 'kg',
    unidades: 'un', unidade: 'un', und: 'un', unds: 'un', uns: 'un',
    litro: 'l', litros: 'l', lt: 'l', lts: 'l',
    pacote: 'pct', pacotes: 'pct', pcts: 'pct',
    caixa: 'cx', caixas: 'cx',
    fardo: 'fd', fardos: 'fd',
};

const STOP_WORDS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'com', 'em', 'e', 'para', 'por', 'no', 'na']);

const normalizeSearchTerm = (term: string): string => {
    const words = term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9\s]/g, '')     // remove especiais
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(w => !STOP_WORDS.has(w) && w.length > 0)
        .map(w => UNIT_MAP[w] || w);
    // Deduplicar palavras (evita "coca cola coca cola" → duplicar keys)
    // e ordenar para normalização posicional
    return [...new Set(words)].sort().join(' ');
};

const WEIGHT_TOKENS = new Set(['kg', 'g', 'ml', 'l', 'un', 'pct', 'cx', 'fd']);
const stripWeightLikeTokens = (normalizedTerm: string): string => {
    const tokens = normalizedTerm.split(' ').filter(Boolean);
    const filtered = tokens.filter((t) => {
        if (WEIGHT_TOKENS.has(t)) return false;
        if (/^\d+$/.test(t)) return false;
        // e.g. 500ml, 2l, 1kg, 12un
        if (/^\d+(kg|g|ml|l|un|pct|cx|fd)$/.test(t)) return false;
        return true;
    });
    return [...new Set(filtered)].sort().join(' ');
};

// Variantes de produto que diferenciam sabores/tipos (NÃO podem ser ignoradas no fuzzy)
const VARIANT_KEYWORDS = new Set([
    'zero', 'light', 'diet', 'sem', 'sugar', 'free',
    'original', 'tradicional', 'classic', 'classico',
    'plus', 'max', 'mini', 'mega', 'ultra', 'pro',
    'suave', 'forte', 'extra', 'premium', 'gold', 'silver',
    'integral', 'desnatado', 'semidesnatado', 'light',
    'sem lactose', 'organico', 'natural',
    'limao', 'laranja', 'uva', 'morango', 'manga', 'abacaxi',
    'maca', 'pessego', 'maracuja', 'guarana', 'cereja',
    'chocolate', 'baunilha', 'caramelo', 'menta', 'hortela',
    'coco', 'amendoim', 'cafe', 'leite', 'mel',
]);

// Valida se um fuzzy match é realmente compatível com o termo buscado
// Rejeita se o resultado tem variantes que a busca não tem (e vice-versa)
const isFuzzyMatchValid = (searchNormalized: string, matchSearchTerm: string): boolean => {
    const searchWords = new Set(searchNormalized.split(' '));
    const matchWords = new Set(normalizeSearchTerm(matchSearchTerm).split(' '));
    
    // Verificar variantes presentes em um mas ausentes no outro
    for (const variant of VARIANT_KEYWORDS) {
        const inSearch = searchWords.has(variant);
        const inMatch = matchWords.has(variant);
        if (inSearch !== inMatch) {
            console.log(`⚠️ [Fuzzy] Rejeitado: variante "${variant}" presente em ${inSearch ? 'busca' : 'match'} mas não no ${inSearch ? 'match' : 'busca'}`);
            return false;
        }
    }
    return true;
};

// Hash determinístico para S3 key (evita duplicatas com timestamp)
const termHash = (normalizedTerm: string): string => {
    return createHash('sha256').update(normalizedTerm).digest('hex').substring(0, 12);
};

// Gera S3 key determinístico para um termo normalizado
const buildDeterministicS3Key = (normalizedTerm: string): string => {
    const safeName = normalizedTerm.replace(/[^a-z0-9]/g, '-').substring(0, 50);
    const hash = termHash(normalizedTerm);
    return `imagens/smart-${safeName}-${hash}.webp`;
};

const normalizeS3KeyForMatch = (s3Key: string): string => {
    const file = decodeURIComponent(String(s3Key).split('/').pop() || '');
    const noExt = file.replace(/\.(webp|png|jpe?g|gif|svg)$/i, '');
    // remove typical prefixes/noise
    const cleaned = noExt
        .replace(/^bg-removed-\d+$/i, '')
        .replace(/^\d+-/, '') // uploads may have timestamp prefix
        .replace(/^smart-/, '')
        .replace(/-[0-9a-f]{10,}$/i, '') // strip hash suffix when present
        .replace(/[-_]+/g, ' ')
        .trim();
    return normalizeSearchTerm(cleaned);
};

const tokenSet = (normalized: string): Set<string> => new Set(normalized.split(' ').filter(Boolean));
const getQueryTokens = (normalized: string): string[] =>
    normalized
        .split(' ')
        .filter(Boolean)
        .filter((t) => t.length > 2)
        .filter((t) => !/^\d+$/.test(t))
        .filter((t) => !WEIGHT_TOKENS.has(t));

const scoreKeyMatch = (queryTokens: string[], keyTokenSet: Set<string>) => {
    if (!queryTokens.length) return { ratio: 0, overlap: 0 };
    let overlap = 0;
    for (const t of queryTokens) if (keyTokenSet.has(t)) overlap++;
    return { ratio: overlap / queryTokens.length, overlap };
};

const findBestS3Match = async (opts: {
    s3: any;
    bucketName: string;
    prefixes: string[];
    normalizedCandidates: string[];
}): Promise<string | null> => {
    const queryTokenVariants = opts.normalizedCandidates
        .filter(Boolean)
        .map((c) => getQueryTokens(c))
        .filter((t) => t.length > 0);

    if (!queryTokenVariants.length) return null;

    let best: { key: string; ratio: number; overlap: number } | null = null;

    for (const prefix of opts.prefixes) {
        let continuationToken: string | undefined;
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: opts.bucketName,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });

            const data = await opts.s3.send(listCommand);
            const contents = data.Contents || [];

            for (const item of contents) {
                const key = item.Key;
                if (!key || key.endsWith('/')) continue;
                // avoid using derived assets as originals
                if (key.startsWith('uploads/bg-removed-')) continue;

                const normalizedKey = normalizeS3KeyForMatch(key);
                if (!normalizedKey) continue;
                const keyTokens = tokenSet(normalizedKey);

                for (const queryTokens of queryTokenVariants) {
                    const { ratio, overlap } = scoreKeyMatch(queryTokens, keyTokens);
                    // Strict acceptance: high overlap ratio, avoid partial matches.
                    // For short queries, require near perfect.
                    const minRatio = queryTokens.length <= 3 ? 0.95 : 0.75;
                    const minOverlap = Math.min(3, queryTokens.length);
                    if (ratio >= minRatio && overlap >= minOverlap) {
                        if (!best || ratio > best.ratio || (ratio === best.ratio && overlap > best.overlap)) {
                            best = { key, ratio, overlap };
                        }
                    }
                }
            }

            continuationToken = data.IsTruncated ? data.NextContinuationToken : undefined;
        } while (continuationToken);
    }

    if (best) {
        console.log(`✅ [S3 Match] Reuso: "${best.key}" (ratio=${best.ratio.toFixed(2)} overlap=${best.overlap})`);
        return best.key;
    }

    return null;
};

// ========================================
// Lazy-load OpenAI para validação de imagem
// ========================================
let openaiInstance: any = null;
const getOpenAI = async () => {
    if (!openaiInstance) {
        const { default: OpenAI } = await import('openai');
        const config = useRuntimeConfig();
        openaiInstance = new OpenAI({ apiKey: config.openaiApiKey || '' });
    }
    return openaiInstance;
};

// ========================================
// Validação por IA: GPT-4o Vision valida imagens candidatas
// ========================================
async function validateImageWithAI(
    imageUrls: string[],
    productInfo: { name: string; brand?: string; flavor?: string; weight?: string }
): Promise<{ bestIndex: number; confidence: number; reason: string }> {
    try {
        const openai = await getOpenAI();

        // Montar descrição do produto
        const desc = [productInfo.name];
        if (productInfo.brand) desc.push(`Marca: ${productInfo.brand}`);
        if (productInfo.flavor) desc.push(`Sabor/Variante: ${productInfo.flavor}`);
        if (productInfo.weight) desc.push(`Peso/Volume: ${productInfo.weight}`);
        const productDescription = desc.join(' | ');

        // Montar conteúdo multimodal com as imagens candidatas
        const imageContents = imageUrls.map((url, i) => ([
            { type: 'text' as const, text: `--- Imagem ${i + 1} ---` },
            { type: 'image_url' as const, image_url: { url, detail: 'low' as const } }
        ])).flat();

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0,
            max_tokens: 300,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Você é um validador especialista em imagens de produtos de supermercado/varejo brasileiro. 
Analise as imagens candidatas e determine qual melhor corresponde ao produto descrito.

CRITÉRIOS DE AVALIAÇÃO (em ordem de importância):
1. A imagem mostra a EMBALAGEM real do produto (não uma foto genérica ou banner publicitário)
2. A MARCA na embalagem corresponde à marca informada
3. O SABOR/VARIANTE corresponde (se aplicável)
4. O PESO/VOLUME corresponde (se aplicável)
5. A imagem tem boa qualidade e mostra o produto claramente

Responda EXCLUSIVAMENTE em JSON:
{
  "bestIndex": <número da melhor imagem (1-based), ou -1 se NENHUMA corresponde>,
  "confidence": <0.0 a 1.0>,
  "reason": "<explicação curta em português>"
}`
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Produto: ${productDescription}\n\nQual destas imagens melhor representa este produto?` },
                        ...imageContents
                    ]
                }
            ]
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
            return { bestIndex: 0, confidence: 0.3, reason: 'Sem resposta da IA' };
        }

        const parsed = JSON.parse(content);
        // Converter de 1-based para 0-based
        const bestIndex = typeof parsed.bestIndex === 'number' 
            ? (parsed.bestIndex === -1 ? -1 : parsed.bestIndex - 1) 
            : 0;
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
        const reason = parsed.reason || '';

        console.log(`🤖 [AI Validate] Produto: "${productInfo.name}" | Melhor: imagem ${bestIndex + 1}/${imageUrls.length} | Confiança: ${(confidence * 100).toFixed(0)}% | ${reason}`);
        
        return { bestIndex, confidence, reason };
    } catch (err: any) {
        console.warn('⚠️ [AI Validate] Falha na validação por IA:', err?.message);
        // Fallback: usar primeira imagem (degradação graceful)
        return { bestIndex: 0, confidence: 0.3, reason: 'Fallback - IA indisponível' };
    }
}

// ========================================
// Cache save com await + retry
// ========================================
async function saveToCacheDB(opts: {
    searchTerm: string;
    productName: string;
    brand?: string;
    flavor?: string;
    weight?: string;
    imageUrl: string;
    s3Key?: string;
    source: string;
    userId?: string;
}, retries = 1): Promise<boolean> {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const supabase = createSupabaseAdmin();
            const { error } = await (supabase.from as any)('product_image_cache').upsert({
                search_term: opts.searchTerm,
                product_name: opts.productName,
                brand: opts.brand || null,
                flavor: opts.flavor || null,
                weight: opts.weight || null,
                image_url: opts.imageUrl,
                s3_key: opts.s3Key || null,
                source: opts.source,
                user_id: opts.userId || null,
                usage_count: 1
            }, {
                onConflict: 'search_term',
                ignoreDuplicates: false
            });

            if (error) throw error;

            console.log(`💾 [Cache DB] Salvo: "${opts.productName}" (${opts.source})`);
            return true;
        } catch (err) {
            if (attempt < retries) {
                console.warn(`⚠️ [Cache DB] Tentativa ${attempt + 1} falhou, retentando...`);
                await new Promise(r => setTimeout(r, 500));
            } else {
                console.warn('⚠️ [Cache DB] Falha ao salvar no cache após retries:', (err as any)?.message);
            }
        }
    }
    return false;
}

// ========================================
// Verifica se S3 key já existe (HeadObject)
// ========================================
async function s3KeyExists(s3: any, bucket: string, key: string): Promise<boolean> {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    } catch {
        return false;
    }
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { term, brand, flavor, weight } = body;

    if (!term) {
        throw createError({ statusCode: 400, statusMessage: "Search term required" });
    }

    const config = useRuntimeConfig();
    const s3 = getS3Client();
    const bucketName = config.wasabiBucket;
    
    // Normalize with structured fields when available, without duplicating tokens already present.
    const baseLower = String(term).toLowerCase();
    const combined = [
        term,
        brand && !baseLower.includes(String(brand).toLowerCase()) ? brand : '',
        flavor && !baseLower.includes(String(flavor).toLowerCase()) ? flavor : '',
        weight && !baseLower.includes(String(weight).toLowerCase()) ? weight : ''
    ]
        .filter(Boolean)
        .join(' ')
        .trim();

    const normalizedTerm = normalizeSearchTerm(combined);
    const deterministicKey = buildDeterministicS3Key(normalizedTerm);
    const normalizedNoWeight = stripWeightLikeTokens(normalizedTerm);
    const candidateNormalizedTerms = normalizedNoWeight && normalizedNoWeight !== normalizedTerm
        ? [normalizedTerm, normalizedNoWeight]
        : [normalizedTerm];
    const candidateKeys = [...new Set(candidateNormalizedTerms.map(buildDeterministicS3Key))];

    console.log(`🔍 [Search] Termo: "${term}" → Normalizado: "${normalizedTerm}" → Key: "${deterministicKey}"`);

    // ========================================
    // 0. CACHE DATABASE (Supabase) - Consulta primeiro
    // ========================================
    try {
        const supabase = createSupabaseAdmin();

        // Busca exata pelos termos normalizados candidatos
        let cacheHit: any = null;
        for (const candidate of candidateNormalizedTerms) {
            const { data } = await supabase
                .from('product_image_cache' as any)
                .select('id, image_url, s3_key, source')
                .eq('search_term', candidate)
                .order('usage_count', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (data?.image_url) {
                cacheHit = data;
                break;
            }
        }

        // Se não encontrou exato, tenta busca fuzzy pelo nome do produto
        if (!cacheHit) {
            const words = normalizedTerm.split(' ').filter(w => w.length > 1);
            if (words.length >= 2) {
                const searchQuery = words.slice(0, 5).join(' & ');
                const { data: fuzzyHits } = await supabase
                    .from('product_image_cache' as any)
                    .select('id, image_url, s3_key, source, search_term')
                    .textSearch('product_name', searchQuery, { type: 'plain', config: 'portuguese' })
                    .order('usage_count', { ascending: false })
                    .limit(5); // buscar mais candidatos para validar variantes
                
                if (fuzzyHits && fuzzyHits.length > 0) {
                    // Validar cada candidato — rejeitar se variante difere
                    const validHit = fuzzyHits.find((hit: any) => 
                        isFuzzyMatchValid(normalizedTerm, hit.search_term || '')
                    );
                    if (validHit) {
                        cacheHit = validHit;
                    } else {
                        console.log(`⚠️ [Cache DB] ${fuzzyHits.length} fuzzy hits rejeitados por variante incompatível`);
                    }
                }
            }
        }

        if (cacheHit && cacheHit.image_url) {
            console.log(`✅ [Cache DB] Hit para "${term}" (source: ${cacheHit.source})`);
            
            // Incrementar usage_count (fire-and-forget — OK para counter)
            supabase.rpc('increment_product_image_usage', { row_id: cacheHit.id })
                .catch(() => { /* ignore */ });

            if (cacheHit.s3_key) {
                return { source: 'cache', url: proxyUrl(cacheHit.s3_key) };
            }
            return { source: 'cache', url: cacheHit.image_url };
        }
    } catch (err) {
        console.warn("⚠️ [Cache DB] Falha na consulta:", (err as any)?.message);
    }

    // ========================================
    // 0.5 GUARD: S3 key determinístico já existe?
    // ========================================
    for (const candidateKey of candidateKeys) {
        const keyAlreadyExists = await s3KeyExists(s3, bucketName, candidateKey);
        if (!keyAlreadyExists) continue;

        console.log(`✅ [S3 Head] Key já existe: "${candidateKey}" — pulando pipeline`);
        
        // Salvar no cache DB (pode ter falhado antes)
        await saveToCacheDB({
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
    // 1. INTERNAL SEARCH (Wasabi S3) - consulta uploads/ e imagens/ antes do Google
    // ========================================
    try {
        const found = await findBestS3Match({
            s3,
            bucketName,
            prefixes: ['uploads/', 'imagens/'],
            normalizedCandidates: candidateNormalizedTerms
        });

        if (found) {
            // Salvar no cache com await para garantir persistência
            await saveToCacheDB({
                searchTerm: normalizedTerm,
                productName: term,
                brand, flavor, weight,
                imageUrl: getPublicUrl(found),
                s3Key: found,
                source: 'internal'
            });

            return { source: 'internal', url: proxyUrl(found) };
        }
    } catch (err) {
        console.warn("Internal search failed:", err);
    }

    // ========================================
    // 2. EXTERNAL SEARCH (Serper.dev) + VALIDAÇÃO IA
    // ========================================
    if (!config.serperApiKey) {
        throw createError({ statusCode: 500, statusMessage: "Serper API Key missing" });
    }

    // Construir query otimizada (mais específica = menos false positives)
    const searchQueryParts: string[] = [term];
    const termLower = String(term).toLowerCase();
    if (brand && !termLower.includes(String(brand).toLowerCase())) searchQueryParts.push(brand);
    if (weight && !termLower.includes(String(weight).toLowerCase())) searchQueryParts.push(weight);
    if (flavor && !['sabores', 'fragrâncias', 'fragancias', 'variados', 'sortidos', 'diversos'].includes(String(flavor).toLowerCase())) {
        if (!termLower.includes(String(flavor).toLowerCase())) searchQueryParts.push(flavor);
    }
    const searchQuery = searchQueryParts.filter(Boolean).join(' ').trim();

    let candidateUrls: string[] = [];
    try {
        const response = await fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
                'X-API-KEY': config.serperApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: `${searchQuery} produto embalagem`,
                gl: 'br',
                hl: 'pt-br',
                num: 10
            })
        });
        
        const result = await response.json();
        if (result.images && result.images.length > 0) {
            // Pegar top 5 candidatas para validação por IA
            candidateUrls = result.images
                .slice(0, 5)
                .map((img: any) => img.imageUrl)
                .filter(Boolean);
        }
    } catch (err) {
        console.error("Serper API error:", err);
        throw createError({ statusCode: 500, statusMessage: "External search failed" });
    }

    if (candidateUrls.length === 0) {
        throw createError({ statusCode: 404, statusMessage: "No image found" });
    }

    // ========================================
    // 2.5 VALIDAÇÃO IA: GPT-4o Vision escolhe a melhor imagem
    // ========================================
    let selectedImageUrl = candidateUrls[0]; // fallback

    if (config.openaiApiKey && candidateUrls.length > 1) {
        try {
            const validation = await validateImageWithAI(candidateUrls, {
                name: term,
                brand: brand || undefined,
                flavor: flavor || undefined,
                weight: weight || undefined
            });

            if (validation.bestIndex >= 0 && validation.bestIndex < candidateUrls.length) {
                if (validation.confidence >= 0.4) {
                    selectedImageUrl = candidateUrls[validation.bestIndex];
                    console.log(`🎯 [AI] Selecionada imagem ${validation.bestIndex + 1}/${candidateUrls.length} com ${(validation.confidence * 100).toFixed(0)}% confiança`);
                } else {
                    console.warn(`⚠️ [AI] Confiança baixa (${(validation.confidence * 100).toFixed(0)}%), usando primeira imagem como fallback`);
                }
            } else if (validation.bestIndex === -1) {
                console.warn(`⚠️ [AI] Nenhuma imagem corresponde ao produto "${term}" — usando primeira como fallback`);
            }
        } catch (err) {
            console.warn('⚠️ [AI] Validação falhou, usando primeira imagem:', (err as any)?.message);
        }
    } else if (candidateUrls.length === 1) {
        console.log('📷 [Serper] Apenas 1 candidata, pulando validação IA');
    }

    // ========================================
    // 3. PROCESS + UPLOAD PIPELINE (S3 key determinístico)
    // ========================================
    try {
        // Guard final: verificar novamente se key já existe (race condition)
        const existsNow = await s3KeyExists(s3, bucketName, deterministicKey);
        if (existsNow) {
            console.log(`✅ [S3 Guard] Key criada por outro request: "${deterministicKey}"`);
            await saveToCacheDB({
                searchTerm: normalizedTerm,
                productName: term,
                brand, flavor, weight,
                imageUrl: getPublicUrl(deterministicKey),
                s3Key: deterministicKey,
                source: 'serper'
            });
            return { source: 'cache-s3', url: proxyUrl(deterministicKey) };
        }

        const rawBuffer = await downloadImage(selectedImageUrl);
        const processedBuffer = await processImage(rawBuffer);
        
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: deterministicKey,
            Body: processedBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        });
        
        await s3.send(putCommand);
        console.log(`📤 [S3] Upload: "${deterministicKey}" (${processedBuffer.length} bytes)`);
        
        // Salvar no cache com await + retry
        await saveToCacheDB({
            searchTerm: normalizedTerm,
            productName: term,
            brand, flavor, weight,
            imageUrl: getPublicUrl(deterministicKey),
            s3Key: deterministicKey,
            source: 'serper'
        });
        
        return {
            source: 'external',
            processing: 'processed',
            url: proxyUrl(deterministicKey)
        };

    } catch (err: any) {
        console.error("Processing pipeline failed:", err);
        throw createError({ statusCode: 500, statusMessage: "Failed to process image", message: err.message });
    }
});
