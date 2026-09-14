import { ListObjectsV2Command } from "@aws-sdk/client-s3";

type CachedS3Object = {
    key: string;
    size?: number;
    lastModified?: Date;
};

type CacheEntry = {
    bucket: string;
    prefixes: string[];
    exclude: string[];
    uploaded: Map<string, CachedS3Object>;
    expiresAt: number;
    data: CachedS3Object[];
    inFlight: Promise<CachedS3Object[]> | null;
};

const s3ObjectCache = new Map<string, CacheEntry>();

// Atualiza também leituras em andamento: uma listagem iniciada antes do PUT
// não pode apagar o arquivo recém-confirmado ao terminar.
export const recordUploadedS3Object = (bucket: string, item: CachedS3Object) => {
    for (const entry of s3ObjectCache.values()) {
        if (entry.bucket !== bucket || !entry.prefixes.some(prefix => item.key.startsWith(prefix)) ||
            entry.exclude.some(prefix => item.key.startsWith(prefix))) continue;
        entry.uploaded.set(item.key, item);
        entry.data = [...entry.data.filter(previous => previous.key !== item.key), item];
    }
};

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
        const response = await s3.send(command, { abortSignal: AbortSignal.timeout(20_000) });
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
        if (response.IsTruncated && scanned < maxKeysPerPrefix) {
            const next = response.NextContinuationToken;
            if (!next || next === continuationToken) {
                throw new Error('Wasabi retornou paginação incompleta; listagem não foi armazenada.');
            }
            continuationToken = next;
        } else {
            continuationToken = undefined;
        }
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
        maxKeysPerPrefix = Number.POSITIVE_INFINITY,
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
    if (existing?.inFlight) {
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

    const uploaded = new Map<string, CachedS3Object>();
    s3ObjectCache.set(cacheKey, {
        bucket, prefixes: normalizedPrefixes, exclude: normalizedExclude, uploaded,
        expiresAt: now + ttlMs,
        data: existing?.data || [],
        inFlight: loader
    });

    try {
        const listed = await loader;
        const merged = new Map(listed.map(item => [item.key, item]));
        for (const item of uploaded.values()) merged.set(item.key, item);
        const data = [...merged.values()];
        s3ObjectCache.set(cacheKey, {
            bucket, prefixes: normalizedPrefixes, exclude: normalizedExclude, uploaded,
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
