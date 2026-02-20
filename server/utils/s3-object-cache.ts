import { ListObjectsV2Command } from "@aws-sdk/client-s3";

type CachedS3Object = {
    key: string;
    size?: number;
    lastModified?: Date;
};

type CacheEntry = {
    expiresAt: number;
    data: CachedS3Object[];
    inFlight: Promise<CachedS3Object[]> | null;
};

const s3ObjectCache = new Map<string, CacheEntry>();

const buildCacheKey = (bucket: string, prefixes: string[], maxKeysPerPrefix: number, exclude: string[]) =>
    `${bucket}::${prefixes.join("|")}::${maxKeysPerPrefix}::${exclude.join("|")}`;

const listPrefixObjects = async (opts: {
    s3: any;
    bucket: string;
    prefix: string;
    maxKeysPerPrefix: number;
    excludeKeyPrefixes: string[];
}): Promise<CachedS3Object[]> => {
    const { s3, bucket, prefix, maxKeysPerPrefix, excludeKeyPrefixes } = opts;
    const out: CachedS3Object[] = [];
    let continuationToken: string | undefined;
    let scanned = 0;

    do {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 1000,
            ContinuationToken: continuationToken
        });
        const response = await s3.send(command);
        const contents = response.Contents || [];

        for (const item of contents) {
            const key = item.Key;
            if (!key || key.endsWith('/')) continue;
            if (excludeKeyPrefixes.some((blocked) => key.startsWith(blocked))) continue;
            out.push({
                key,
                size: item.Size,
                lastModified: item.LastModified
            });
        }

        scanned += contents.length;
        continuationToken = (response.IsTruncated && scanned < maxKeysPerPrefix)
            ? response.NextContinuationToken
            : undefined;
    } while (continuationToken);

    return out;
};

export const getCachedS3Objects = async (opts: {
    s3: any;
    bucket: string;
    prefixes: string[];
    ttlMs?: number;
    maxKeysPerPrefix?: number;
    excludeKeyPrefixes?: string[];
    forceRefresh?: boolean;
}): Promise<CachedS3Object[]> => {
    const {
        s3,
        bucket,
        prefixes,
        ttlMs = 120_000,
        maxKeysPerPrefix = 1000,
        excludeKeyPrefixes = [],
        forceRefresh = false
    } = opts;

    const normalizedPrefixes = [...new Set(prefixes.map((p) => String(p || '').trim()).filter(Boolean))].sort();
    const normalizedExclude = [...new Set(excludeKeyPrefixes.map((p) => String(p || '').trim()).filter(Boolean))].sort();
    const cacheKey = buildCacheKey(bucket, normalizedPrefixes, maxKeysPerPrefix, normalizedExclude);
    const now = Date.now();
    const existing = s3ObjectCache.get(cacheKey);

    if (!forceRefresh && existing && existing.expiresAt > now && existing.data.length > 0) {
        return existing.data;
    }
    if (!forceRefresh && existing?.inFlight) {
        return existing.inFlight;
    }

    const loader = (async () => {
        const lists = await Promise.all(
            normalizedPrefixes.map((prefix) =>
                listPrefixObjects({
                    s3,
                    bucket,
                    prefix,
                    maxKeysPerPrefix,
                    excludeKeyPrefixes: normalizedExclude
                })
            )
        );

        const dedup = new Map<string, CachedS3Object>();
        for (const group of lists) {
            for (const item of group) {
                const prev = dedup.get(item.key);
                if (!prev) {
                    dedup.set(item.key, item);
                    continue;
                }
                const prevTs = prev.lastModified ? new Date(prev.lastModified).getTime() : 0;
                const nextTs = item.lastModified ? new Date(item.lastModified).getTime() : 0;
                if (nextTs > prevTs) dedup.set(item.key, item);
            }
        }
        return Array.from(dedup.values());
    })();

    s3ObjectCache.set(cacheKey, {
        expiresAt: now + ttlMs,
        data: existing?.data || [],
        inFlight: loader
    });

    try {
        const data = await loader;
        s3ObjectCache.set(cacheKey, {
            expiresAt: Date.now() + ttlMs,
            data,
            inFlight: null
        });
        return data;
    } catch (err) {
        const fallback = s3ObjectCache.get(cacheKey);
        if (fallback?.data?.length) {
            // Serve stale cache for a short window if refresh fails.
            fallback.expiresAt = Date.now() + Math.min(ttlMs, 15_000);
            fallback.inFlight = null;
            return fallback.data;
        }
        s3ObjectCache.delete(cacheKey);
        throw err;
    }
};
