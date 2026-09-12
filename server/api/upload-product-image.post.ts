import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { createHash } from "crypto";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { saveProductImageCache } from "../utils/product-image-cache";
import { buildProductIdentityKey, upsertProductImageRegistry } from "../utils/product-image-registry";
import { normalizeSearchTerm as normalizeSharedSearchTerm } from "../utils/product-image-matching";
import { resolveStorageReadUrl } from "../utils/project-storage-refs";
import { processImageWithOptions } from "../utils/image-processor";
import { trimRasterImageBuffer } from "../utils/image-trim";

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
const PROCESS_VERSION = 'birefnet-v1';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB

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

const getAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
    const timeoutFactory = (AbortSignal as any)?.timeout;
    if (typeof timeoutFactory !== 'function') return undefined;
    return timeoutFactory(timeoutMs);
};

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    await enforceRateLimit(event, `upload-product-image:${user.id}`, 40, 60_000)
    const form = await readMultipartFormData(event);
    if (!form) {
        throw createError({ statusCode: 400, statusMessage: "Form data required" });
    }

    const filePart = form.find(p => p.name === 'file');
    const productNamePart = form.find(p => p.name === 'productName');
    const brandPart = form.find(p => p.name === 'brand');
    const flavorPart = form.find(p => p.name === 'flavor');
    const weightPart = form.find(p => p.name === 'weight');
    const productCodePart = form.find(p => p.name === 'productCode');
    const removeBackgroundPart = form.find(p => p.name === 'removeBackground');

    if (!filePart?.data || !productNamePart?.data) {
        throw createError({ statusCode: 400, statusMessage: "File and product name required" });
    }

    const fileBuffer = Buffer.from(filePart.data);
    const fileSize = Number(fileBuffer.length || 0)
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
        throw createError({ statusCode: 400, statusMessage: "Invalid file size (max 12MB)" });
    }

    const mime = String(filePart.type || '').trim().toLowerCase()
    if (!mime.startsWith('image/')) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid file type. Only images are allowed.' })
    }

    const productName = Buffer.from(productNamePart.data).toString('utf8').trim();
    const brand = brandPart?.data ? Buffer.from(brandPart.data).toString('utf8').trim() : null;
    const flavor = flavorPart?.data ? Buffer.from(flavorPart.data).toString('utf8').trim() : null;
    const weight = weightPart?.data ? Buffer.from(weightPart.data).toString('utf8').trim() : null;
    const productCode = productCodePart?.data ? Buffer.from(productCodePart.data).toString('utf8').trim().replace(/[^a-zA-Z0-9]/g, '') : null;
    const removeBackgroundValue = removeBackgroundPart?.data
        ? Buffer.from(removeBackgroundPart.data).toString('utf8').trim().toLowerCase()
        : '';
    // Uploads de produto já entram prontos para o card por padrão. A opção
    // explícita do modo rápido pode desligar o processamento quando o usuário
    // precisa preservar o fundo original.
    const shouldRemoveBackground = !['false', '0', 'off', 'never', 'no'].includes(removeBackgroundValue);
    if (!productName || productName.length > 180) {
        throw createError({ statusCode: 400, statusMessage: "Invalid product name" });
    }
    if ((brand && brand.length > 120) || (flavor && flavor.length > 120) || (weight && weight.length > 60) || (productCode && productCode.length > 64)) {
        throw createError({ statusCode: 400, statusMessage: "Invalid metadata length" });
    }

    const config = useRuntimeConfig();
    const s3 = getS3Client();
    const bucketName = config.wasabiBucket;

    try {
        // Retain source bytes so a damaged segmentation can be reprocessed.
        const originalHash = createHash('sha256').update(fileBuffer).digest('hex');
        const originalKey = `imagens/originals/${originalHash}`;
        await s3.send(new PutObjectCommand({ Bucket: bucketName, Key: originalKey, Body: fileBuffer, ContentType: mime || 'application/octet-stream' }));
        // Processamento automático para upload manual: remoção de fundo +
        // recorte/otimização. O utilitário tem fallback seguro para a imagem
        // original caso o modelo não esteja disponível ou seja inconclusivo.
        let processedBuffer: Buffer = fileBuffer as Buffer;
        let contentType = mime || 'image/png';
        const canRemoveBackground = shouldRemoveBackground && !['image/gif', 'image/svg+xml'].includes(mime);
        if (canRemoveBackground) {
            try {
                processedBuffer = await processImageWithOptions(fileBuffer, {
                    outputFormat: 'webp',
                    forceBgRemoval: true,
                    strict: true
                });
                contentType = 'image/webp';
                console.log('✅ [Manual Upload] Fundo removido e imagem otimizada');
            } catch (err) {
                throw createError({ statusCode: 422, statusMessage: 'Não foi possível remover o fundo com segurança. A imagem não foi alterada.' });
            }
        }

        if (!['image/gif', 'image/svg+xml'].includes(mime)) {
            try {
                const sharp = (await import('sharp')).default;
                // Aplicar também a WebP e ao resultado da remoção de fundo.
                // O arquivo persistido deve ter os mesmos limites do preview.
                const trimmedBuffer = await trimRasterImageBuffer(processedBuffer);
                processedBuffer = await sharp(trimmedBuffer)
                    .rotate()
                    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 88, effort: 4, alphaQuality: 100 })
                    .toBuffer();
                contentType = 'image/webp';
                console.log('✅ [Manual Upload] Otimização rápida aplicada');
            } catch (err) {
                console.warn('⚠️ [Manual Upload] Otimização falhou, usando original:', (err as any)?.message);
                // Usar original somente no pior caso
            }
        }

        // Upload para Wasabi
        const normalizedTerm = normalizeSearchTerm(
            [productName, brand, flavor, weight].filter(Boolean).join(' ')
        );
        const identityKey = buildProductIdentityKey({
            productCode: productCode || undefined,
            normalizedTerm: normalizeSharedSearchTerm([productName, brand, flavor, weight].filter(Boolean).join(' ')),
            brand: brand || undefined,
            flavor: flavor || undefined,
            weight: weight || undefined
        });
        const safeName = (normalizedTerm || productName.toLowerCase())
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
        const hash = createHash('sha256').update(normalizedTerm || productName).digest('hex').substring(0, 12);
        const ext = contentType === 'image/webp' ? 'webp' : mime.split('/')[1] || 'png';
        const variant = canRemoveBackground ? 'bg' : 'original';
        // Uma troca de imagem precisa trocar a URL: o proxy e o navegador
        // podem guardar a versão anterior. Incluir o conteúdo final também
        // distingue um recorte corrigido do anterior para o mesmo produto.
        const contentHash = createHash('sha256').update(processedBuffer).digest('hex').substring(0, 16);
        const key = `imagens/manual-${safeName}-${hash}-${PROCESS_VERSION}-${contentHash}-${variant}.${ext}`;

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: contentType,
            ACL: 'public-read'
        });

        const abortSignal = getAbortSignal(90_000);
        if (abortSignal) await s3.send(putCommand, { abortSignal });
        else await s3.send(putCommand);

        const canonicalUrl = getPublicUrl(key);
        const readUrl = await resolveStorageReadUrl(key, user.id);

        // Salvar no cache do banco (fire-and-forget — não bloqueia resposta)
        void saveProductImageCache({
            searchTerm: normalizedTerm,
            productName,
            brand: brand || undefined,
            flavor: flavor || undefined,
            weight: weight || undefined,
            imageUrl: canonicalUrl,
            s3Key: key,
            source: 'manual',
            userId: user.id
        }).then((ok) => {
            if (!ok) console.warn('⚠️ [Cache DB] Falha ao salvar cache de upload manual');
            else console.log(`💾 [Manual Upload] Salvo no cache: "${productName}"`);
        }).catch(() => { /* ignore */ });
        void upsertProductImageRegistry({
            productCode: productCode || undefined,
            identityKey,
            canonicalName: productName,
            brand: brand || undefined,
            flavor: flavor || undefined,
            weight: weight || undefined,
            s3Key: key,
            source: 'manual',
            validationLevel: 'manual-upload',
            validatedBy: user.id,
            status: 'approved'
        }).catch(() => { /* ignore */ });

        return {
            source: 'manual',
            url: readUrl || canonicalUrl,
            publicUrl: readUrl || canonicalUrl,
            canonicalUrl,
            key: key,
            originalKey,
            backgroundRemovalRequested: shouldRemoveBackground,
            backgroundRemovalApplied: canRemoveBackground
        };

    } catch (err: any) {
        console.error("Upload failed:", err);
        throw createError({ statusCode: err?.statusCode || 500, statusMessage: "Failed to upload image: " + (err?.message || String(err)) });
    }
});
