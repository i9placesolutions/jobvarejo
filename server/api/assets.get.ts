import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCachedS3Objects } from "../utils/s3-object-cache";

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

    const normalizeText = (value: string) =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9.\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const query = getQuery(event);
    const rawSearch = typeof query.q === 'string' ? query.q.trim() : '';
    const normalizedSearch = normalizeText(rawSearch);
    const searchMode = normalizedSearch.length >= 2;
    const requestedLimit = Number(query.limit ?? 200);
    const resultLimit = Number.isFinite(requestedLimit)
        ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
        : 200;

    try {
        const listedObjects = await getCachedS3Objects({
            s3: s3Client,
            bucket: String(bucketName),
            prefixes: ['imagens/'],
            ttlMs: 120_000,
            maxKeysPerPrefix: searchMode ? 8000 : 1000,
            excludeKeyPrefixes: ['imagens/bg-removed-']
        });

        const listEntries: Array<{ key: string; name: string; normalizedName: string; size?: number; lastModified?: Date }> = [];
        for (const item of listedObjects) {
            const key = item.key;
            const rawName = key.split('/').pop()?.replace(/^\d+-/, '') || key;
            const baseName = rawName.replace(/\.[^/.]+$/, '');
            let decodedName = baseName;
            try {
                decodedName = decodeURIComponent(baseName);
            } catch {
                // Keep original token when filename has malformed URI encoding.
                decodedName = baseName;
            }
            const normalizedName = normalizeText(decodedName);
            if (searchMode && !normalizedName.includes(normalizedSearch)) continue;
            listEntries.push({
                key,
                name: decodedName,
                normalizedName,
                size: item.size,
                lastModified: item.lastModified
            });
        }

        listEntries.sort((a, b) => {
            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return dateB - dateA;
        });

        const finalEntries = searchMode ? listEntries.slice(0, resultLimit) : listEntries;
        const assets = await Promise.all(
            finalEntries.map(async (item) => {
                const getCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: item.key
                });
                const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

                return {
                    id: item.key,
                    name: item.name,
                    url: signedUrl,
                    size: item.size,
                    lastModified: item.lastModified
                };
            })
        );

        return assets;
    } catch (error: any) {
        console.error("Wasabi S3 List Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list assets: " + error.message });
    }
});
