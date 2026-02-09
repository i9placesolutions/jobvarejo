import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { createSupabaseAdmin } from "../utils/supabase";
import { processImage, processImageStrict } from "../utils/image-processor";
import { createHash } from "crypto";
import { requireAuthenticatedUser } from "../utils/auth";

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
const PROCESS_VERSION = 'v2';

const normalizeSearchTerm = (term: string): string => {
    const words = term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/(\d)[,](\d)/g, '$1.$2')
        .replace(/[^a-z0-9.\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!words) return '';
    return [...new Set(words.split(' ')
        .filter(w => !STOP_WORDS.has(w) && w.length > 0)
        .map(w => UNIT_MAP[w] || w))]
        .sort()
        .join(' ');
};

export default defineEventHandler(async (event) => {
    await requireAuthenticatedUser(event);
    const form = await readMultipartFormData(event);
    if (!form) {
        throw createError({ statusCode: 400, statusMessage: "Form data required" });
    }

    const filePart = form.find(p => p.name === 'file');
    const productNamePart = form.find(p => p.name === 'productName');
    const brandPart = form.find(p => p.name === 'brand');
    const flavorPart = form.find(p => p.name === 'flavor');
    const weightPart = form.find(p => p.name === 'weight');

    if (!filePart?.data || !productNamePart?.data) {
        throw createError({ statusCode: 400, statusMessage: "File and product name required" });
    }

    const fileBuffer = Buffer.from(filePart.data);
    const productName = Buffer.from(productNamePart.data).toString('utf8').trim();
    const brand = brandPart?.data ? Buffer.from(brandPart.data).toString('utf8').trim() : null;
    const flavor = flavorPart?.data ? Buffer.from(flavorPart.data).toString('utf8').trim() : null;
    const weight = weightPart?.data ? Buffer.from(weightPart.data).toString('utf8').trim() : null;
    const mime = String(filePart.type || 'image/png');

    const config = useRuntimeConfig();
    const s3 = getS3Client();
    const bucketName = config.wasabiBucket;

    try {
        // Processar a imagem (resize + remove bg)
        let processedBuffer: Buffer = fileBuffer as Buffer;
        let contentType = mime;
        
        try {
            processedBuffer = await processImageStrict(fileBuffer) as Buffer;
            contentType = 'image/webp';
            console.log('✅ [Manual Upload] Fundo removido (strict)');
        } catch (err) {
            console.warn('⚠️ [Manual Upload] processImageStrict falhou, fallback processImage:', (err as any)?.message);
            try {
                processedBuffer = await processImage(fileBuffer) as Buffer;
                contentType = 'image/webp';
                console.log('✅ [Manual Upload] Processamento fallback aplicado');
            } catch (err2) {
                console.warn('⚠️ [Manual Upload] processImage fallback falhou, usando original:', (err2 as any)?.message);
                // Usar original somente no pior caso
            }
        }

        // Upload para Wasabi
        const normalizedTerm = normalizeSearchTerm(
            [productName, brand, flavor, weight].filter(Boolean).join(' ')
        );
        const safeName = (normalizedTerm || productName.toLowerCase())
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
        const hash = createHash('sha256').update(normalizedTerm || productName).digest('hex').substring(0, 12);
        const ext = contentType === 'image/webp' ? 'webp' : mime.split('/')[1] || 'png';
        const key = `imagens/manual-${safeName}-${hash}-${PROCESS_VERSION}.${ext}`;

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: contentType,
            ACL: 'public-read'
        }));

        const publicUrl = getPublicUrl(key);
        const proxyUrl = `/api/storage/proxy?key=${encodeURIComponent(key)}`;

        // Salvar no cache do banco (fire-and-forget — não bloqueia resposta)
        const supabase = createSupabaseAdmin();
        (supabase.from as any)('product_image_cache').upsert({
            search_term: normalizedTerm,
            product_name: productName,
            brand: brand,
            flavor: flavor,
            weight: weight,
            image_url: publicUrl,
            s3_key: key,
            source: 'manual',
            usage_count: 1
        }, {
            onConflict: 'search_term',
            ignoreDuplicates: false
        }).then((res: any) => {
            if (res?.error) console.warn('⚠️ [Cache DB] Falha ao salvar:', res.error.message);
            else console.log(`💾 [Manual Upload] Salvo no cache: "${productName}"`);
        }).catch(() => { /* ignore */ });

        return {
            source: 'manual',
            url: proxyUrl,
            publicUrl: publicUrl,
            key: key
        };

    } catch (err: any) {
        console.error("Upload failed:", err);
        throw createError({ statusCode: 500, statusMessage: "Failed to upload image", message: err.message });
    }
});
