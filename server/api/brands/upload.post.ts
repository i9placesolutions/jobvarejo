import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const endpoint = config.contaboEndpoint;
    const region = config.contaboRegion || "default";
    const accessKeyId = config.contaboAccessKey;
    const secretAccessKey = config.contaboSecretKey;
    const brandsBucket = config.contaboBrandsBucket;

    if (!accessKeyId || !secretAccessKey || !endpoint) {
        throw createError({
            statusCode: 500,
            statusMessage: "Contabo Storage configuration missing"
        });
    }

    if (!brandsBucket) {
        throw createError({
            statusCode: 500,
            statusMessage: "Brands bucket not configured (CONTABO_BRANDS_BUCKET)"
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

    // Usar o nome original do arquivo sem timestamp
    const key = file.filename;

    try {
        const command = new PutObjectCommand({
            Bucket: brandsBucket,
            Key: key,
            Body: file.data,
            ContentType: file.type,
            ACL: 'public-read'
        });

        await s3Client.send(command);

        // Construct public URL
        const publicUrl = `https://${endpoint}/${brandsBucket}/${key}`;

        return {
            url: publicUrl,
            success: true
        };
    } catch (error) {
        console.error("Brand Upload Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to upload brand to Contabo" });
    }
});
