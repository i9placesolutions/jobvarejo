import { processImage, downloadImage } from "~/server/utils/image-processor";
import { getS3Client } from "~/server/utils/s3";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { imageUrl } = body;

    if (!imageUrl) {
        throw createError({ statusCode: 400, statusMessage: "imageUrl is required" });
    }

    try {
        console.log('🎨 [Remove BG] Iniciando remoção de fundo para:', imageUrl);

        // Download image
        const rawBuffer = await downloadImage(imageUrl);

        // Process (resize + remove BG + optimize)
        const processedBuffer = await processImage(rawBuffer);

        // Upload to S3
        const config = useRuntimeConfig();
        const s3 = getS3Client();
        const bucketName = config.contaboBucket;

        const timestamp = Date.now();
        const key = `uploads/bg-removed-${timestamp}.webp`;

        const { PutObjectCommand } = await import("@aws-sdk/client-s3");

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        });

        await s3.send(putCommand);

        // Generate public URL
        const finalUrl = `https://${config.contaboEndpoint}/${bucketName}/${key}`;

        console.log('✅ [Remove BG] Fundo removido com sucesso:', finalUrl);

        return {
            success: true,
            url: finalUrl
        };

    } catch (err: any) {
        console.error("❌ [Remove BG] Erro ao remover fundo:", err);
        throw createError({ statusCode: 500, statusMessage: "Failed to remove background", message: err.message });
    }
});
