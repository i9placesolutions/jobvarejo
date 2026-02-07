import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { processImage, downloadImage } from "../utils/image-processor";
import { createSupabaseAdmin } from "../utils/supabase";

/** Build a same-origin proxy URL for a given S3 key (avoids CORS + no expiration) */
const proxyUrl = (key: string) => `/api/storage/proxy?key=${encodeURIComponent(key)}`;

// Normaliza termo para comparação de cache
const normalizeSearchTerm = (term: string): string => {
    return term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/[^a-z0-9\s]/g, '')     // remove especiais
        .replace(/\s+/g, ' ')
        .trim();
};

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { term, brand, flavor, weight } = body;

    if (!term) {
        throw createError({ statusCode: 400, statusMessage: "Search term required" });
    }

    const config = useRuntimeConfig();
    const s3 = getS3Client();
    const bucketName = config.wasabiBucket;
    
    const normalizedTerm = normalizeSearchTerm(term);

    // ========================================
    // 0. CACHE DATABASE (Supabase) - Consulta primeiro
    // ========================================
    try {
        const supabase = createSupabaseAdmin();
        
        // Busca exata pelo termo normalizado
        let { data: cacheHit } = await supabase
            .from('product_image_cache' as any)
            .select('id, image_url, s3_key, source')
            .eq('search_term', normalizedTerm)
            .order('usage_count', { ascending: false })
            .limit(1)
            .single();

        // Se não encontrou exato, tenta busca fuzzy pelo nome do produto
        if (!cacheHit) {
            const words = normalizedTerm.split(' ').filter(w => w.length > 2);
            if (words.length >= 2) {
                // Busca por palavras-chave no nome do produto
                const searchQuery = words.slice(0, 4).join(' & ');
                const { data: fuzzyHits } = await supabase
                    .from('product_image_cache' as any)
                    .select('id, image_url, s3_key, source, search_term')
                    .textSearch('product_name', searchQuery, { type: 'plain', config: 'portuguese' })
                    .order('usage_count', { ascending: false })
                    .limit(1);
                
                if (fuzzyHits && fuzzyHits.length > 0) {
                    cacheHit = fuzzyHits[0];
                }
            }
        }

        if (cacheHit && cacheHit.image_url) {
            console.log(`✅ [Cache DB] Hit para "${term}" (source: ${cacheHit.source})`);
            
            // Incrementar usage_count (fire-and-forget, 1 query só)
            supabase.rpc('increment_product_image_usage', { row_id: cacheHit.id })
                .catch(() => { /* ignore */ });

            // Se tem s3_key, usar proxy URL (sem CORS, sem expiração)
            if (cacheHit.s3_key) {
                return { source: 'cache', url: proxyUrl(cacheHit.s3_key) };
            }

            return { source: 'cache', url: cacheHit.image_url };
        }
    } catch (err) {
        console.warn("⚠️ [Cache DB] Falha na consulta:", (err as any)?.message);
        // Continuar para outros métodos
    }

    // ========================================
    // 1. INTERNAL SEARCH (Wasabi S3)
    // ========================================
    const s3NormalizedTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');
    try {
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'imagens/',
            MaxKeys: 1000
        });
        
        const data = await s3.send(listCommand);
        if (data.Contents) {
            const match = data.Contents.find(item => {
                if(!item.Key) return false;
                const decodedKey = decodeURIComponent(item.Key);
                const normalizedKey = decodedKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedKey.includes(s3NormalizedTerm);
            });
            
            if (match && match.Key) {
                // Salvar no cache para próximas buscas (fire-and-forget)
                saveToCacheDB({
                    searchTerm: normalizedTerm,
                    productName: term,
                    brand, flavor, weight,
                    imageUrl: getPublicUrl(match.Key),
                    s3Key: match.Key,
                    source: 'internal'
                });

                return { source: 'internal', url: proxyUrl(match.Key) };
            }
        }
    } catch (err) {
        console.warn("Internal search failed:", err);
    }

    // ========================================
    // 2. EXTERNAL SEARCH (Serper.dev)
    // ========================================
    if (!config.serperApiKey) {
        throw createError({ statusCode: 500, statusMessage: "Serper API Key missing" });
    }

    // Construir query otimizada para sabores/fragrâncias
    let searchQuery = term;
    if (flavor && !['sabores', 'fragrâncias', 'fragancias', 'variados', 'sortidos', 'diversos'].includes(flavor.toLowerCase())) {
        // Sabor específico — incluir na busca
        if (!term.toLowerCase().includes(flavor.toLowerCase())) {
            searchQuery = `${term} ${flavor}`;
        }
    }

    let imageUrl = '';
    try {
        const response = await fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
                'X-API-KEY': config.serperApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: searchQuery + ' produto embalagem',
                gl: 'br',
                hl: 'pt-br'
            })
        });
        
        const result = await response.json();
        if (result.images && result.images.length > 0) {
            imageUrl = result.images[0].imageUrl;
        }
    } catch (err) {
        console.error("Serper API error:", err);
        throw createError({ statusCode: 500, statusMessage: "External search failed" });
    }

    if (!imageUrl) {
        throw createError({ statusCode: 404, statusMessage: "No image found" });
    }

    // ========================================
    // 3. PROCESS + UPLOAD PIPELINE
    // ========================================
    try {
        const rawBuffer = await downloadImage(imageUrl);
        const processedBuffer = await processImage(rawBuffer);
        
        const timestamp = Date.now();
        const safeName = term.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
        const key = `imagens/smart-${safeName}-${timestamp}.webp`;
        
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        });
        
        await s3.send(putCommand);
        
        // Salvar no cache para próximas buscas (fire-and-forget)
        saveToCacheDB({
            searchTerm: normalizedTerm,
            productName: term,
            brand, flavor, weight,
            imageUrl: getPublicUrl(key),
            s3Key: key,
            source: 'serper'
        });
        
        return {
            source: 'external',
            processing: 'processed',
            url: proxyUrl(key)
        };

    } catch (err: any) {
        console.error("Processing pipeline failed:", err);
        throw createError({ statusCode: 500, statusMessage: "Failed to process image", message: err.message });
    }
});

// Helper: Salvar imagem no cache do banco
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
}) {
    try {
        const supabase = createSupabaseAdmin();
        await (supabase.from as any)('product_image_cache').upsert({
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
        console.log(`💾 [Cache DB] Salvo: "${opts.productName}" (${opts.source})`);
    } catch (err) {
        console.warn('⚠️ [Cache DB] Falha ao salvar no cache:', (err as any)?.message);
        // Não bloquear o fluxo por falha no cache
    }
}
