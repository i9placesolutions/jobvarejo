import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { createSupabaseAdmin } from "../utils/supabase";

// Normaliza termo para cache
const normalizeSearchTerm = (term: string): string => {
    return term
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

export default defineEventHandler(async (event) => {
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
        // Processar a imagem (resize + remove bg) se possível
        let processedBuffer = fileBuffer;
        let contentType = mime;
        
        try {
            const { processImage } = await import('../utils/image-processor');
            processedBuffer = await processImage(fileBuffer);
            contentType = 'image/webp';
        } catch (err) {
            console.warn('⚠️ Processamento de imagem falhou, usando original:', (err as any)?.message);
            // Usar imagem original sem processamento
        }

        // Upload para Wasabi
        const timestamp = Date.now();
        const safeName = productName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
        const ext = contentType === 'image/webp' ? 'webp' : mime.split('/')[1] || 'png';
        const key = `uploads/manual-${safeName}-${timestamp}.${ext}`;

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
        const normalizedTerm = normalizeSearchTerm(
            [productName, brand, flavor, weight].filter(Boolean).join(' ')
        );

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
