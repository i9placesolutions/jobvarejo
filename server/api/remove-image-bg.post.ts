import { processImageWithOptions, downloadImage } from "~/server/utils/image-processor";
import { getS3Client } from "~/server/utils/s3";

const extractWasabiKeyFromUrl = (rawUrl: string, bucketName: string): string | null => {
    try {
        const decoded = decodeURIComponent(rawUrl);
        const urlObj = new URL(decoded);
        const pathParts = decodeURIComponent(urlObj.pathname).split('/').filter(Boolean);
        if (pathParts.length === 0) return null;

        // Path-style: /<bucket>/<key...>
        if (pathParts[0] === bucketName) {
            return pathParts.slice(1).join('/');
        }

        // Virtual-host style: https://<bucket>.<endpoint>/<key...>
        const host = urlObj.hostname;
        if (host.startsWith(`${bucketName}.`)) {
            return pathParts.join('/');
        }

        return null;
    } catch {
        return null;
    }
};

export default defineEventHandler(async (event) => {
    try {
        const contentType = getHeader(event, "content-type") || "";

        let rawBuffer: Buffer | null = null;
        let sourceLabel = "unknown";
        let imageUrl: string | null = null;
        let overwrite = false;

        if (contentType.includes("multipart/form-data")) {
            const form = await readMultipartFormData(event);
            const file = form?.find((p) => p.name === "file") || form?.[0];
            const overwriteField = form?.find((p) => p.name === "overwrite") as any;
            overwrite = overwriteField?.data ? String(overwriteField.data).toLowerCase() === 'true' || String(overwriteField.data) === '1' : false;

            if (!file?.data) {
                throw createError({ statusCode: 400, statusMessage: "file is required" });
            }

            rawBuffer = file.data;
            sourceLabel = file.filename || "uploaded file";
        } else {
            const body = await readBody(event);
            const { imageUrl: bodyImageUrl, imageDataUrl, overwrite: bodyOverwrite } = body || {};
            overwrite = bodyOverwrite === true || bodyOverwrite === 1 || bodyOverwrite === '1';

            if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
                const match = /^data:([^;]+);base64,(.+)$/.exec(imageDataUrl);
                if (!match) {
                    throw createError({ statusCode: 400, statusMessage: "Invalid imageDataUrl" });
                }
                rawBuffer = Buffer.from(match[2], "base64");
                sourceLabel = "data-url";
            } else if (typeof bodyImageUrl === "string" && bodyImageUrl) {
                imageUrl = bodyImageUrl;
                sourceLabel = bodyImageUrl;
                rawBuffer = await downloadImage(bodyImageUrl);
            } else {
                throw createError({ statusCode: 400, statusMessage: "imageUrl or file is required" });
            }
        }

        console.log("🎨 [Remove BG] Iniciando remoção de fundo para:", sourceLabel);

        const config = useRuntimeConfig();
        const s3 = getS3Client();
        const bucketName = config.wasabiBucket;

        const timestamp = Date.now();

        // Resolve destination key for overwrite or temp output
        let key: string | null = null;
        let overwritten = false;
        let outputFormat: 'webp' | 'png' = 'webp';

        if (overwrite && imageUrl) {
            const extractedKey = extractWasabiKeyFromUrl(imageUrl, bucketName);
            if (extractedKey) {
                key = extractedKey;
                overwritten = true;
                const lower = extractedKey.toLowerCase();
                outputFormat = lower.endsWith('.png') ? 'png' : 'webp';
            }
        }

        if (!key) {
            // Keep derived images in imagens/ folder
            key = `imagens/bg-removed-${timestamp}.${outputFormat === 'png' ? 'png' : 'webp'}`;
        }

        // Process (resize + remove BG + optimize)
        const processedBuffer = await processImageWithOptions(rawBuffer, { outputFormat });

        // Upload to Wasabi S3 (overwrite or new key)
        const contentTypeOut = outputFormat === 'png' ? 'image/png' : 'image/webp';

        const { PutObjectCommand } = await import("@aws-sdk/client-s3");

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: contentTypeOut,
            ACL: 'public-read'
        });

        await s3.send(putCommand);

        // Generate public URL
        const endpoint = config.wasabiEndpoint || 's3.wasabisys.com';
        const canonicalUrl = `https://${endpoint}/${bucketName}/${key}`;
        const finalUrl = `${canonicalUrl}?v=${timestamp}`;

        console.log('✅ [Remove BG] Fundo removido com sucesso:', finalUrl);

        return {
            success: true,
            url: finalUrl,
            canonicalUrl,
            key,
            overwritten
        };

    } catch (err: any) {
        console.error("❌ [Remove BG] Erro ao remover fundo:", err);
        throw createError({ statusCode: 500, statusMessage: "Failed to remove background", message: err.message });
    }
});
