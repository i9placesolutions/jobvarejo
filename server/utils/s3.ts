import { S3Client } from "@aws-sdk/client-s3";

let _s3ClientInstance: S3Client | null = null;

export const getS3Client = () => {
    if (_s3ClientInstance) return _s3ClientInstance;

    const config = useRuntimeConfig();

    // Wasabi Configuration (primary) — fallback direto em process.env para Docker/Coolify
    const endpoint = config.wasabiEndpoint || process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || '';
    const region = config.wasabiRegion || process.env.WASABI_REGION || process.env.NUXT_WASABI_REGION || "us-east-1";
    const accessKeyId = config.wasabiAccessKey || process.env.WASABI_ACCESS_KEY || process.env.NUXT_WASABI_ACCESS_KEY || '';
    const secretAccessKey = config.wasabiSecretKey || process.env.WASABI_SECRET_KEY || process.env.NUXT_WASABI_SECRET_KEY || '';

    if (!accessKeyId || !secretAccessKey || !endpoint) {
        const missing: string[] = []
        if (!endpoint) missing.push('WASABI_ENDPOINT')
        if (!accessKeyId) missing.push('WASABI_ACCESS_KEY')
        if (!secretAccessKey) missing.push('WASABI_SECRET_KEY')

        throw createError({
            statusCode: 500,
            statusMessage: `Wasabi Storage configuration missing (${missing.join(', ')})`
        });
    }

    _s3ClientInstance = new S3Client({
        region: region,
        endpoint: `https://${endpoint}`,
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        forcePathStyle: true,
        maxAttempts: 1,
        requestHandler: {
            requestTimeout: 20_000,
            connectionTimeout: 5_000
        } as any
    });

    return _s3ClientInstance;
};

/**
 * Reseta o singleton do S3 client (útil se credenciais mudarem).
 */
export const resetS3Client = () => {
    if (_s3ClientInstance) {
        _s3ClientInstance.destroy();
        _s3ClientInstance = null;
    }
};

const resolveWasabiEndpoint = () => {
    const config = useRuntimeConfig();
    return config.wasabiEndpoint || process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || 's3.wasabisys.com';
}
const resolveWasabiBucket = () => {
    const config = useRuntimeConfig();
    return config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo';
}

export const getPublicUrl = (key: string) => {
    return `https://${resolveWasabiEndpoint()}/${resolveWasabiBucket()}/${key}`;
}

export const getBrandsPublicUrl = (key: string) => {
    return `https://${resolveWasabiEndpoint()}/${resolveWasabiBucket()}/logo/${key}`;
}

/**
 * Obter URL para pasta de imagens
 * Wasabi usa path style: https://s3.wasabisys.com/bucket/imagens/key
 */
export const getImagesPublicUrl = (key: string) => {
    return `https://${resolveWasabiEndpoint()}/${resolveWasabiBucket()}/imagens/${key}`;
}

/**
 * Obter cliente S3 para brands/logos (mesmo bucket, pasta diferente)
 */
export const getBrandsS3Client = () => {
    return getS3Client(); // Wasabi usa o mesmo cliente, apenas pasta diferente
}
