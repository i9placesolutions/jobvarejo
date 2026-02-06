import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * API Route para upload de logos/marcas para Wasabi Storage
 *
 * Usa a pasta 'logo/' dentro do bucket jobvarejo
 */

export default defineEventHandler(async (event) => {
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
    if (!file.filename) {
        throw createError({ statusCode: 400, statusMessage: "Filename missing" });
    }

    // Usar pasta 'logo/' conforme solicitado
    // Manter o nome original do arquivo
    const key = `logo/${file.filename}`;

    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file.data,
            ContentType: file.type
        });

        await s3Client.send(command);

        // Construct public URL
        const publicUrl = `https://${endpoint}/${bucketName}/${key}`;

        console.log('✅ Brand logo uploaded to Wasabi:', key);

        return {
            url: publicUrl,
            key: key,
            success: true
        };
    } catch (error) {
        console.error("Brand Upload Error to Wasabi:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to upload brand to Wasabi" });
    }
});
