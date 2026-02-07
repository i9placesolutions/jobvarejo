import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * API Route para listar assets da Wasabi Storage
 *
 * Lista arquivos na pasta 'imagens/' do bucket jobvarejo
 */
export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const endpoint = config.wasabiEndpoint;
    const region = config.wasabiRegion || "us-east-1";
    const accessKeyId = config.wasabiAccessKey;
    const secretAccessKey = config.wasabiSecretKey;
    const bucketName = config.wasabiBucket;

    if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
        const missing: string[] = []
        if (!endpoint) missing.push('WASABI_ENDPOINT')
        if (!bucketName) missing.push('WASABI_BUCKET')
        if (!accessKeyId) missing.push('WASABI_ACCESS_KEY')
        if (!secretAccessKey) missing.push('WASABI_SECRET_KEY')

        throw createError({
            statusCode: 500,
            statusMessage: `Wasabi Storage configuration missing (${missing.join(', ')})`
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

    try {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'imagens/', // Pasta de imagens no Wasabi
            // IMPORTANT: list enough keys so the newest uploads actually appear.
            // S3 lists lexicographically by Key; with timestamp-based names, newest tend to be at the end.
            MaxKeys: 1000
        });

        const response = await s3Client.send(command);

        const assets = await Promise.all(
            (response.Contents || [])
                .filter(item => item.Key && !item.Key.endsWith('/'))
                .filter(item => !String(item.Key).startsWith('imagens/bg-removed-')) // Hide derived assets from library
                .map(async (item) => {
                    const key = item.Key!;
                    const name = key.split('/').pop()?.replace(/^\d+-/, '') || key;

                    // Generate pre-signed URL (valid for 1 hour)
                    const getCommand = new GetObjectCommand({
                        Bucket: bucketName,
                        Key: key,
                        ChecksumMode: 'DISABLED'
                    });
                    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

                    return {
                        id: key,
                        name: decodeURIComponent(name.replace(/\.[^/.]+$/, '')), // Decode URL chars (e.g. %20 -> space)
                        url: signedUrl,
                        size: item.Size,
                        lastModified: item.LastModified
                    };
                })
        );

        // Sort by most recent
        assets.sort((a, b) => {
            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return dateB - dateA;
        });

        return assets;
    } catch (error: any) {
        console.error("Wasabi S3 List Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list assets: " + error.message });
    }
});
