import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const endpoint = config.contaboEndpoint;
    const region = config.contaboRegion || "default";
    const accessKeyId = config.contaboAccessKey;
    const secretAccessKey = config.contaboSecretKey;
    const bucketName = config.contaboBucket;

    if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
        const missing: string[] = []
        if (!endpoint) missing.push('CONTABO_ENDPOINT')
        if (!bucketName) missing.push('CONTABO_BUCKET')
        if (!accessKeyId) missing.push('CONTABO_ACCESS_KEY')
        if (!secretAccessKey) missing.push('CONTABO_SECRET_KEY')

        throw createError({
            statusCode: 500,
            statusMessage: `Contabo Storage configuration missing (${missing.join(', ')})`
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
            Prefix: 'uploads/',
            MaxKeys: 100
        });

        const response = await s3Client.send(command);
        
        const assets = await Promise.all(
            (response.Contents || [])
                .filter(item => item.Key && !item.Key.endsWith('/'))
                .filter(item => !String(item.Key).startsWith('uploads/bg-removed-')) // Hide derived assets from library
                .map(async (item) => {
                    const key = item.Key!;
                    const name = key.split('/').pop()?.replace(/^\d+-/, '') || key;
                    
                    // Generate pre-signed URL (valid for 1 hour)
                    // ChecksumMode DISABLED for S3-compatible storage (e.g. Contabo) that may return 500
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
        console.error("S3 List Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list assets: " + error.message });
    }
});
