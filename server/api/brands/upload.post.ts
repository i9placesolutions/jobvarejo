import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAuthenticatedUser } from "../../utils/auth";
import { enforceRateLimit } from "../../utils/rate-limit";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB

const sanitizeBrandFileName = (value: string): string => {
    const base = String(value || '')
        .split(/[\\/]/)
        .pop()
        ?.trim() || ''
    if (!base) return ''

    const cleaned = base
        .replace(/[^\w.\- ]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    return cleaned.slice(0, 120)
}

/**
 * API Route para upload de logos/marcas para Wasabi Storage
 *
 * Usa a pasta 'logo/' dentro do bucket jobvarejo
 */

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `brands-upload:${user.id}`, 30, 60_000)
    const config = useRuntimeConfig();
    const endpoint = config.wasabiEndpoint;
    const region = config.wasabiRegion || "us-east-1";
    const accessKeyId = config.wasabiAccessKey;
    const secretAccessKey = config.wasabiSecretKey;
    const bucketName = config.wasabiBucket;

    if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
        throw createError({
            statusCode: 500,
            statusMessage: "Wasabi Storage configuration missing"
        });
    }

    const s3Client = new S3Client({
        region: region,
        endpoint: `https://${endpoint}`,
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        forcePathStyle: true
    });

    const files = await readMultipartFormData(event);
    if (!files || files.length === 0) {
        throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
    }

    const file = files[0];
    if (!file?.filename || !file.data) {
        throw createError({ statusCode: 400, statusMessage: "Filename missing" });
    }
    if (!String(file.type || '').startsWith('image/')) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid file type. Only image uploads are allowed.' })
    }
    const size = Number(file.data?.length || 0)
    if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid file size (max 10MB)' })
    }
    const safeFileName = sanitizeBrandFileName(file.filename)
    if (!safeFileName) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid filename' })
    }

    // Usar pasta 'logo/' conforme solicitado
    // Manter o nome original do arquivo
    const key = `logo/${safeFileName}`;

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file.data,
            ContentType: file.type,
            ACL: 'public-read'
        });

        await s3Client.send(command);

        console.log('✅ Brand logo uploaded to Wasabi:', key);

        return {
            url: `/api/storage/p?key=${encodeURIComponent(key)}`,
            key: key,
            success: true
        };
    } catch (error) {
        console.error("Brand Upload Error to Wasabi:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to upload brand to Wasabi" });
    }
});
