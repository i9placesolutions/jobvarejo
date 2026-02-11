import { S3Client } from "@aws-sdk/client-s3";
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
    const wantsPaginated =
        String(query.paginated ?? '').toLowerCase() === '1' ||
        String(query.paginated ?? '').toLowerCase() === 'true' ||
        typeof query.cursor === 'string';
    const forceFresh =
        String(query.fresh ?? '').toLowerCase() === '1' ||
        String(query.fresh ?? '').toLowerCase() === 'true';
    const hasExplicitLimit = query.limit !== undefined;
    const requestedLimit = Number(query.limit ?? 200);
    const resultLimit = Number.isFinite(requestedLimit)
        ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
        : 200;
    const requestedCursor = Number(query.cursor ?? 0);
    const startIndex = Number.isFinite(requestedCursor)
        ? Math.max(0, Math.floor(requestedCursor))
        : 0;
    const toProxyUrl = (key: string) => `/api/storage/proxy?key=${encodeURIComponent(key)}`;

    try {
        const listedObjects = await getCachedS3Objects({
            s3: s3Client,
            bucket: String(bucketName),
            prefixes: ['imagens/'],
            ttlMs: 120_000,
            maxKeysPerPrefix: searchMode ? 8000 : 1000,
            excludeKeyPrefixes: ['imagens/bg-removed-'],
            forceRefresh: forceFresh
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

        const mapToAsset = (item: { key: string; name: string; size?: number; lastModified?: Date }) => ({
            id: item.key,
            name: item.name,
            url: toProxyUrl(item.key),
            size: item.size,
            lastModified: item.lastModified
        });

        if (wantsPaginated) {
            const endIndex = Math.min(listEntries.length, startIndex + resultLimit);
            const pageEntries = listEntries.slice(startIndex, endIndex);
            const nextCursor = endIndex < listEntries.length ? String(endIndex) : null;
            return {
                items: pageEntries.map(mapToAsset),
                nextCursor,
                hasMore: nextCursor !== null,
                total: listEntries.length
            };
        }

        const shouldApplyLimit = searchMode || hasExplicitLimit;
        const finalEntries = shouldApplyLimit ? listEntries.slice(0, resultLimit) : listEntries;
        return finalEntries.map(mapToAsset);
    } catch (error: any) {
        console.error("Wasabi S3 List Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list assets: " + error.message });
    }
});
