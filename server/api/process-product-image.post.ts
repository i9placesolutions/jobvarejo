import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { processImage, processImageStrict, downloadImage } from "../utils/image-processor";
import { createSupabaseAdmin } from "../utils/supabase";
import { createHash } from 'crypto';
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { getCachedS3Objects } from "../utils/s3-object-cache";

/** Build a same-origin proxy URL for a given S3 key (avoids CORS + no expiration) */
const proxyUrl = (key: string) => `/api/storage/proxy?key=${encodeURIComponent(key)}`;

// ========================================
// Normalização avançada de search term
// ========================================
const UNIT_MAP: Record<string, string> = {
    mililitros: 'ml', mililitro: 'ml', mls: 'ml',
    gramas: 'g', grama: 'g', gram: 'g', gr: 'g', grs: 'g', gs: 'g',
    quilos: 'kg', quilo: 'kg', quilogramas: 'kg', quilograma: 'kg', kgs: 'kg',
    unidades: 'un', unidade: 'un', und: 'un', unds: 'un', uns: 'un',
    litro: 'l', litros: 'l', lt: 'l', lts: 'l', litr: 'l', litrs: 'l',
    pacote: 'pct', pacotes: 'pct', pcts: 'pct',
    caixa: 'cx', caixas: 'cx',
    fardo: 'fd', fardos: 'fd',
};

const STOP_WORDS = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'com', 'em', 'e', 'para', 'por', 'no', 'na']);

const normalizeWeightNumber = (value: string): string => {
    const n = Number(String(value || '').replace(',', '.'));
    if (!Number.isFinite(n)) return String(value || '').replace(',', '.');
    const normalized = String(n);
    return normalized.includes('.') ? normalized.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : normalized;
};

const normalizeWeightToken = (rawWeight: string): string => {
    const compact = String(rawWeight || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
        .replace(/grs?\b/g, 'g')
        .replace(/lt\b/g, 'l');

    const multipack = compact.match(/^(\d+)x(\d+(?:\.\d+)?)(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/);
    if (multipack) {
        const multiplier = String(Number(multipack[1] || '0'));
        const qty = normalizeWeightNumber(multipack[2] || '0');
        const unitRaw = multipack[3] || '';
        const unit = unitRaw === 'gr' || unitRaw === 'grs'
            ? 'g'
            : unitRaw === 'lt' || unitRaw === 'lts'
                ? 'l'
                : unitRaw === 'kgs'
                    ? 'kg'
                    : unitRaw === 'mls'
                        ? 'ml'
                        : unitRaw;
        return `${multiplier}x${qty}${unit}`;
    }

    const single = compact.match(/^(\d+(?:\.\d+)?)(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/);
    if (single) {
        const qty = normalizeWeightNumber(single[1] || '0');
        const unitRaw = single[2] || '';
        const unit = unitRaw === 'gr' || unitRaw === 'grs'
            ? 'g'
            : unitRaw === 'lt' || unitRaw === 'lts'
                ? 'l'
                : unitRaw === 'kgs'
                    ? 'kg'
                    : unitRaw === 'mls'
                        ? 'ml'
                        : unitRaw;
        return `${qty}${unit}`;
    }

    return compact;
};

const normalizeSearchTerm = (term: string): string => {
    const words = term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/(\d)[,](\d)/g, '$1.$2') // normaliza decimal brasileiro
        .replace(/[^a-z0-9.\s]/g, ' ')     // remove especiais
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(w => !STOP_WORDS.has(w) && w.length > 0)
        .map(w => UNIT_MAP[w] || w);
    // Deduplicar palavras (evita "coca cola coca cola" → duplicar keys)
    // e ordenar para normalização posicional
    return [...new Set(words)].sort().join(' ');
};

const WEIGHT_TOKENS = new Set(['kg', 'kgs', 'g', 'gr', 'grs', 'mg', 'ml', 'mls', 'l', 'lt', 'lts', 'un', 'pct', 'cx', 'fd']);
const stripWeightLikeTokens = (normalizedTerm: string): string => {
    const tokens = normalizedTerm.split(' ').filter(Boolean);
    const filtered = tokens.filter((t) => {
        if (WEIGHT_TOKENS.has(t)) return false;
        if (/^\d+(?:[.,]\d+)?$/.test(t)) return false;
        // e.g. 500ml, 2l, 1kg, 12un
        if (/^\d+(?:[.,]\d+)?(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un|pct|cx|fd)$/.test(t)) return false;
        // e.g. 12x500ml
        if (/^\d+x\d+(?:[.,]\d+)?(kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un|pct|cx|fd)$/.test(t)) return false;
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

// Extrai tokens de peso/volume de um conjunto de palavras normalizadas.
// Retorna tokens como "250ml", "500g", "2l" ou pares separados ["250", "ml"].
const extractWeightTokens = (words: Set<string>): string[] => {
    const weightParts: string[] = [];
    const unitTokens = new Set(['kg', 'kgs', 'g', 'gr', 'grs', 'mg', 'ml', 'mls', 'l', 'lt', 'lts', 'un']);
    
    for (const w of words) {
        const token = String(w || '').trim().toLowerCase();
        if (!token) continue;

        // Multipack/combo: 12x500ml, 6x1l, 2x5kg
        if (/^\d+x\d+(?:[.,]\d+)?(?:kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/i.test(token)) {
            weightParts.push(normalizeWeightToken(token));
            continue;
        }
        // Token combinado: "250ml", "500g", "2l", "1kg"
        if (/^\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grs|mg|ml|mls|l|lt|lts|un)$/i.test(token)) {
            weightParts.push(normalizeWeightToken(token));
            continue;
        }
        // Token puramente numérico adjacente a uma unidade
        if (/^\d+(?:[.,]\d+)?$/.test(token)) {
            // Verificar se existe um token de unidade no mesmo set
            for (const u of unitTokens) {
                if (words.has(u)) {
                    weightParts.push(normalizeWeightToken(`${token}${u}`));
                    break;
                }
            }
        }
    }
    return [...new Set(weightParts)].sort();
};

type FuzzyRejectReason = 'variant' | 'weight_mismatch' | 'weight_missing';
type FuzzyRejectMeta = { reason: FuzzyRejectReason; message: string };
type FuzzyRejectCollector = (meta: FuzzyRejectMeta) => void;

// Valida se um fuzzy match é realmente compatível com o termo buscado
// Rejeita se o resultado tem variantes que a busca não tem (e vice-versa)
// TAMBÉM rejeita se peso/gramatura difere entre busca e match
const isFuzzyMatchValid = (searchNormalized: string, matchSearchTerm: string, onReject?: FuzzyRejectCollector): boolean => {
    const searchWords = new Set(searchNormalized.split(' '));
    const matchNormalized = normalizeSearchTerm(matchSearchTerm);
    const matchWords = new Set(matchNormalized.split(' '));
    
    // 1. Verificar variantes presentes em um mas ausentes no outro
    for (const variant of VARIANT_KEYWORDS) {
        const inSearch = searchWords.has(variant);
        const inMatch = matchWords.has(variant);
        if (inSearch !== inMatch) {
            onReject?.({
                reason: 'variant',
                message: `variante "${variant}" presente em ${inSearch ? 'busca' : 'match'} mas não no ${inSearch ? 'match' : 'busca'}`
            });
            return false;
        }
    }
    
    // 2. Verificar peso/gramatura: se ambos têm tokens de peso, devem ser iguais
    const searchWeights = extractWeightTokens(searchWords);
    const matchWeights = extractWeightTokens(matchWords);
    
    if (searchWeights.length > 0 && matchWeights.length > 0) {
        const searchWeightStr = searchWeights.join('|');
        const matchWeightStr = matchWeights.join('|');
        if (searchWeightStr !== matchWeightStr) {
            onReject?.({
                reason: 'weight_mismatch',
                message: `peso/gramatura difere — busca="${searchWeightStr}" vs match="${matchWeightStr}"`
            });
            return false;
        }
    }
    
    // 3. Verificar se um tem peso e outro não (provável produto diferente)
    if (searchWeights.length > 0 && matchWeights.length === 0) {
        onReject?.({
            reason: 'weight_missing',
            message: `busca tem peso "${searchWeights.join('|')}" mas match não tem`
        });
        return false;
    }
    
    return true;
};

const hasWeightInNormalized = (normalized: string): boolean => {
    const words = tokenSet(normalized);
    return extractWeightTokens(words).length > 0;
};

// Hash determinístico para S3 key (evita duplicatas com timestamp)
const termHash = (normalizedTerm: string): string => {
    return createHash('sha256').update(normalizedTerm).digest('hex').substring(0, 12);
};

// Gera S3 key determinístico para um termo normalizado
// VERSÃO da pipeline de processamento. Incrementar quando mudar a lógica de bg-removal
// para forçar reprocessamento de imagens cached sem bg removal.
const PROCESS_VERSION = 'v2';

const buildDeterministicS3Key = (normalizedTerm: string): string => {
    const safeName = normalizedTerm.replace(/[^a-z0-9]/g, '-').substring(0, 50);
    const hash = termHash(normalizedTerm);
    return `imagens/smart-${safeName}-${hash}-${PROCESS_VERSION}.webp`;
};

const normalizeS3KeyForMatch = (s3Key: string): string => {
    let file = String(s3Key).split('/').pop() || '';
    try {
        file = decodeURIComponent(file);
    } catch {
        // keep raw filename if malformed URI component
    }
    const noExt = file.replace(/\.(webp|png|jpe?g|gif|svg)$/i, '');
    // remove typical prefixes/noise
    const cleaned = noExt
        .replace(/^bg-removed-\d+$/i, '')
        .replace(/^\d+-/, '') // uploads may have timestamp prefix
        .replace(/^smart-/, '')
        .replace(/-v\d+$/i, '') // strip version suffix (e.g. -v2) — must run BEFORE hash strip
        .replace(/-[0-9a-f]{10,}(-v\d+)?$/i, '') // strip hash suffix (with optional version) when present
        .replace(/[-_]+/g, ' ')
        .trim();
    return normalizeSearchTerm(cleaned);
};

const normalizedS3KeyMemo = new Map<string, string>();
const getNormalizedS3KeyForMatch = (s3Key: string): string => {
    const cached = normalizedS3KeyMemo.get(s3Key);
    if (cached !== undefined) return cached;
    const normalized = normalizeS3KeyForMatch(s3Key);
    if (normalizedS3KeyMemo.size > 20_000) normalizedS3KeyMemo.clear();
    normalizedS3KeyMemo.set(s3Key, normalized);
    return normalized;
};

type BestS3MatchCacheEntry = {
    expiresAt: number;
    result: string | null;
};
const bestS3MatchMemo = new Map<string, BestS3MatchCacheEntry>();
const buildBestS3MatchCacheKey = (opts: { bucketName: string; prefixes: string[]; normalizedCandidates: string[] }) => {
    const bucket = String(opts.bucketName || '').trim();
    const prefixes = [...new Set((opts.prefixes || []).map((p) => String(p || '').trim()).filter(Boolean))].sort();
    const candidates = [...new Set((opts.normalizedCandidates || []).map((p) => String(p || '').trim()).filter(Boolean))].sort();
    return `${bucket}::${prefixes.join('|')}::${candidates.join('|')}`;
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
    const bestMatchCacheKey = buildBestS3MatchCacheKey(opts);
    const now = Date.now();
    const cachedBest = bestS3MatchMemo.get(bestMatchCacheKey);
    if (cachedBest && cachedBest.expiresAt > now) {
        return cachedBest.result;
    }

    const queryVariants = opts.normalizedCandidates
        .filter(Boolean)
        .map((normalized) => ({ normalized, tokens: getQueryTokens(normalized) }))
        .filter((entry) => entry.tokens.length > 0);

    if (!queryVariants.length) {
        bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: now + 20_000, result: null });
        return null;
    }

    let best: { key: string; ratio: number; overlap: number } | null = null;
    const fuzzyRejectStats = {
        total: 0,
        variant: 0,
        weight_mismatch: 0,
        weight_missing: 0
    };
    const fuzzyRejectSamples: string[] = [];
    const verboseFuzzy = process.env.DEBUG_FUZZY === '1';
    const collectFuzzyReject: FuzzyRejectCollector = (meta) => {
        fuzzyRejectStats.total++;
        fuzzyRejectStats[meta.reason]++;
        if (verboseFuzzy && fuzzyRejectSamples.length < 6) {
            fuzzyRejectSamples.push(meta.message);
        }
    };

    const listedObjects = await getCachedS3Objects({
        s3: opts.s3,
        bucket: opts.bucketName,
        prefixes: opts.prefixes,
        ttlMs: 60_000,
        maxKeysPerPrefix: 8_000,
        excludeKeyPrefixes: ['uploads/bg-removed-']
    });

    for (const item of listedObjects) {
        const key = item.key;
        if (!key) continue;

        const normalizedKey = getNormalizedS3KeyForMatch(key);
        if (!normalizedKey) continue;
        const keyTokens = tokenSet(normalizedKey);

        for (let idx = 0; idx < queryVariants.length; idx++) {
            const queryNormalized = queryVariants[idx]!.normalized;
            // Hard validation first: variant/gramatura/weight compatibility.
            if (!isFuzzyMatchValid(queryNormalized, normalizedKey, collectFuzzyReject)) continue;

            const queryTokens = queryVariants[idx]!.tokens;
            const { ratio, overlap } = scoreKeyMatch(queryTokens, keyTokens);
            // Strict acceptance: high overlap ratio, avoid partial matches.
            // For short queries, require near perfect.
            const requiresWeightStrict = hasWeightInNormalized(queryNormalized);
            const minRatio = requiresWeightStrict
                ? (queryTokens.length <= 3 ? 1 : 0.85)
                : (queryTokens.length <= 3 ? 0.95 : 0.75);
            const minOverlap = Math.min(3, queryTokens.length);
            if (ratio >= minRatio && overlap >= minOverlap) {
                if (!best || ratio > best.ratio || (ratio === best.ratio && overlap > best.overlap)) {
                    best = { key, ratio, overlap };
                }
            }
        }
    }

    if (best) {
        if (verboseFuzzy && fuzzyRejectStats.total > 0) {
            console.log(`ℹ️ [Fuzzy] Resumo: total=${fuzzyRejectStats.total}, variante=${fuzzyRejectStats.variant}, peso_diferente=${fuzzyRejectStats.weight_mismatch}, peso_ausente=${fuzzyRejectStats.weight_missing}`);
            if (fuzzyRejectSamples.length > 0) {
                fuzzyRejectSamples.forEach((sample) => console.log(`   • ${sample}`));
            }
        }
        console.log(`✅ [S3 Match] Reuso: "${best.key}" (ratio=${best.ratio.toFixed(2)} overlap=${best.overlap})`);
        bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: Date.now() + 45_000, result: best.key });
        if (bestS3MatchMemo.size > 5000) {
            bestS3MatchMemo.clear();
        }
        return best.key;
    }

    if (verboseFuzzy && fuzzyRejectStats.total > 0) {
        console.log(`ℹ️ [Fuzzy] Resumo: total=${fuzzyRejectStats.total}, variante=${fuzzyRejectStats.variant}, peso_diferente=${fuzzyRejectStats.weight_mismatch}, peso_ausente=${fuzzyRejectStats.weight_missing}`);
        if (fuzzyRejectSamples.length > 0) {
            fuzzyRejectSamples.forEach((sample) => console.log(`   • ${sample}`));
        }
    }

    bestS3MatchMemo.set(bestMatchCacheKey, { expiresAt: Date.now() + 20_000, result: null });
    if (bestS3MatchMemo.size > 5000) {
        bestS3MatchMemo.clear();
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
    candidates: Array<{ url: string; title?: string; source?: string }>,
    productInfo: { name: string; brand?: string; flavor?: string; weight?: string; normalizedQuery?: string }
): Promise<{ bestIndex: number; confidence: number; reason: string }> {
    try {
        const openai = await getOpenAI();

        // Montar descrição do produto
        const desc = [productInfo.name];
        if (productInfo.brand) desc.push(`Marca: ${productInfo.brand}`);
        if (productInfo.flavor) desc.push(`Sabor/Variante: ${productInfo.flavor}`);
        if (productInfo.weight) desc.push(`Peso/Volume: ${productInfo.weight}`);
        if (productInfo.normalizedQuery) desc.push(`Consulta Normalizada: ${productInfo.normalizedQuery}`);
        const productDescription = desc.join(' | ');

        // Montar conteúdo multimodal com as imagens candidatas
        const imageContents = candidates.map((entry, i) => ([
            { type: 'text' as const, text: `--- Imagem ${i + 1} ---\nTítulo: ${entry.title || 'N/A'}\nFonte: ${entry.source || 'N/A'}` },
            { type: 'image_url' as const, image_url: { url: entry.url, detail: 'low' as const } }
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
3. O PESO/VOLUME/GRAMATURA deve bater exatamente quando informado (ex.: 500ml != 1L, 12x500ml != 6x1L)
4. O SABOR/VARIANTE corresponde (se aplicável)
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

        console.log(`🤖 [AI Validate] Produto: "${productInfo.name}" | Melhor: imagem ${bestIndex + 1}/${candidates.length} | Confiança: ${(confidence * 100).toFixed(0)}% | ${reason}`);
        
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
// Helper: garante que imagem tem fundo removido
// Sempre verifica se a versão processada (deterministicKey com PROCESS_VERSION)
// já existe. Se não, baixa do sourceKey, processa (bg removal), e faz upload.
// ========================================
async function ensureBgRemoved(opts: {
    s3: any;
    bucketName: string;
    sourceKey: string;
    deterministicKey: string;
    normalizedTerm: string;
    term: string;
    brand?: string;
    flavor?: string;
    weight?: string;
}): Promise<{ key: string; processed: boolean } | null> {
    const { s3, bucketName, sourceKey, deterministicKey, normalizedTerm, term, brand, flavor, weight } = opts;

    // Se sourceKey JÁ É o deterministicKey versionado (mesma key) → já foi processado
    if (sourceKey === deterministicKey) {
        return { key: sourceKey, processed: false };
    }

    // Verificar se o key determinístico versionado (processado) já existe
    const exists = await s3KeyExists(s3, bucketName, deterministicKey);
    if (exists) {
        console.log(`✅ [ensureBgRemoved] Key processado ${PROCESS_VERSION} já existe: "${deterministicKey}"`);
        return { key: deterministicKey, processed: false };
    }

    // Baixar via S3 SDK diretamente (mais confiável que HTTP público), processar, e fazer upload
    try {
        let rawBuffer: Buffer;
        try {
            // Tentar via S3 SDK primeiro (evita problemas de rede/CORS)
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            const getResponse = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: sourceKey }));
            const stream = getResponse.Body as any;
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            rawBuffer = Buffer.concat(chunks);
            console.log(`📥 [ensureBgRemoved] Baixado via S3 SDK: "${sourceKey}" (${rawBuffer.length} bytes)`);
        } catch (s3Err) {
            // Fallback: tentar via URL pública
            console.warn(`⚠️ [ensureBgRemoved] S3 SDK falhou, tentando URL pública:`, (s3Err as any)?.message);
            const publicUrl = getPublicUrl(sourceKey);
            rawBuffer = await downloadImage(publicUrl);
        }

        const processedBuffer = await processImageStrict(rawBuffer);

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: deterministicKey,
            Body: processedBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        }));

        console.log(`📤 [ensureBgRemoved] Imagem processada e salva: "${deterministicKey}" (${processedBuffer.length} bytes)`);

        await saveToCacheDB({
            searchTerm: normalizedTerm,
            productName: term,
            brand, flavor, weight,
            imageUrl: getPublicUrl(deterministicKey),
            s3Key: deterministicKey,
            source: 'internal-processed'
        });

        return { key: deterministicKey, processed: true };
    } catch (err) {
        console.error('⚠️ [ensureBgRemoved] Falha ao processar imagem:', (err as any)?.message, (err as any)?.stack?.split('\n').slice(0, 3).join(' | '));
        return null;
    }
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `process-product-image:${user.id}`, 30, 60_000);

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
    // Se a consulta tem gramatura/peso explícito, NUNCA relaxar para versão "sem peso".
    const candidateNormalizedTerms = hasWeightInNormalized(normalizedTerm)
        ? [normalizedTerm]
        : (normalizedNoWeight && normalizedNoWeight !== normalizedTerm
            ? [normalizedTerm, normalizedNoWeight]
            : [normalizedTerm]);
    const candidateKeys = [...new Set(candidateNormalizedTerms.map(buildDeterministicS3Key))];

    console.log(`🔍 [Search] Termo: "${term}" → Normalizado: "${normalizedTerm}" → Key: "${deterministicKey}"`);

    // ========================================
    // 0. GUARD: S3 key determinístico já existe?
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
            // Garantir que imagem interna tem fundo removido
            const processed = await ensureBgRemoved({
                s3, bucketName,
                sourceKey: found,
                deterministicKey,
                normalizedTerm, term, brand, flavor, weight
            });
            if (processed) {
                return { source: processed.processed ? 'internal-processed' : 'internal', url: proxyUrl(processed.key) };
            }

            // Fallback: retornar imagem crua se processamento falhou
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
    // 1.5 CACHE DATABASE (Supabase) - fallback exato com s3_key
    // ========================================
    try {
        const supabase = createSupabaseAdmin();

        // Busca exata pelos termos normalizados candidatos (sem fuzzy para evitar imagem errada)
        let cacheHit: any = null;
        for (const candidate of candidateNormalizedTerms) {
            const { data } = await (supabase.from as any)('product_image_cache')
                .select('id, image_url, s3_key, source')
                .eq('search_term', candidate)
                .order('usage_count', { ascending: false })
                .limit(1)
                .maybeSingle();
            const row = data as any;
            if (row?.s3_key) {
                cacheHit = row;
                break;
            }
        }

        if (cacheHit?.s3_key) {
            const exists = await s3KeyExists(s3, bucketName, cacheHit.s3_key);
            if (!exists) {
                console.warn(`⚠️ [Cache DB] s3_key inexistente, ignorando cache: ${cacheHit.s3_key}`);
            } else {
                console.log(`✅ [Cache DB] Hit exato para "${term}" (source: ${cacheHit.source})`);
                // Incrementar usage_count (fire-and-forget — OK para counter)
                void (supabase.rpc as any)('increment_product_image_usage', { row_id: cacheHit.id });

                // Garantir que imagem do cache tem fundo removido
                const processed = await ensureBgRemoved({
                    s3, bucketName,
                    sourceKey: cacheHit.s3_key,
                    deterministicKey,
                    normalizedTerm, term, brand, flavor, weight
                });
                if (processed) {
                    return { source: 'cache-processed', url: proxyUrl(processed.key) };
                }
                return { source: 'cache', url: proxyUrl(cacheHit.s3_key) };
            }
        }
    } catch (err) {
        console.warn("⚠️ [Cache DB] Falha na consulta:", (err as any)?.message);
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

    let candidates: Array<{ url: string; title?: string; source?: string }> = [];
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
            const seen = new Set<string>();
            candidates = result.images
                .slice(0, 5)
                .map((img: any) => ({
                    url: String(img.imageUrl || '').trim(),
                    title: String(img.title || '').trim(),
                    source: String(img.source || img.link || '').trim()
                }))
                .filter((img: any) => img.url)
                .filter((img: any) => {
                    if (seen.has(img.url)) return false;
                    seen.add(img.url);
                    return true;
                });
        }
    } catch (err) {
        console.error("Serper API error:", err);
        throw createError({ statusCode: 500, statusMessage: "External search failed" });
    }

    if (candidates.length === 0) {
        throw createError({ statusCode: 404, statusMessage: "No image found" });
    }

    // ========================================
    // 2.5 VALIDAÇÃO IA: GPT-4o Vision escolhe a melhor imagem
    // ========================================
    let selectedImageUrl = candidates[0]!.url; // fallback

    if (config.openaiApiKey && candidates.length > 1) {
        try {
            const validation = await validateImageWithAI(candidates, {
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
                    throw createError({
                        statusCode: 404,
                        statusMessage: `No reliable image found for "${term}" (AI confidence ${(validation.confidence * 100).toFixed(0)}%)`
                    });
                }
            } else if (validation.bestIndex === -1) {
                throw createError({
                    statusCode: 404,
                    statusMessage: `No matching image found for "${term}" (AI rejected candidates)`
                });
            }
        } catch (err) {
            if ((err as any)?.statusCode === 404) throw err;
            console.warn('⚠️ [AI] Validação falhou, usando primeira imagem:', (err as any)?.message);
        }
    } else if (candidates.length === 1) {
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
        let processedBuffer: Buffer;
        try {
            processedBuffer = await processImageStrict(rawBuffer);
            console.log('✅ [Serper] Background removido com sucesso');
        } catch (bgErr) {
            console.warn('⚠️ [Serper] processImageStrict falhou, usando processImage normal:', (bgErr as any)?.message);
            processedBuffer = await processImage(rawBuffer);
        }
        
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
