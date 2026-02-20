import { S3Client } from "@aws-sdk/client-s3";

export const getS3Client = () => {
    const config = useRuntimeConfig();

    // Wasabi Configuration (primary)
    const endpoint = config.wasabiEndpoint;
    const region = config.wasabiRegion || "us-east-1";
    const accessKeyId = config.wasabiAccessKey;
    const secretAccessKey = config.wasabiSecretKey;

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

    return new S3Client({
        region: region,
        endpoint: `https://${endpoint}`,
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        forcePathStyle: true
    });
};

export const getPublicUrl = (key: string) => {
    const config = useRuntimeConfig();
    return `https://${config.wasabiEndpoint}/${config.wasabiBucket}/${key}`;
}

export const getBrandsPublicUrl = (key: string) => {
    const config = useRuntimeConfig();
    return `https://${config.wasabiEndpoint}/${config.wasabiBucket}/logo/${key}`;
}

/**
 * Obter URL para pasta de imagens
 * Wasabi usa path style: https://s3.wasabisys.com/bucket/imagens/key
 */
export const getImagesPublicUrl = (key: string) => {
    const config = useRuntimeConfig();
    return `https://${config.wasabiEndpoint}/${config.wasabiBucket}/imagens/${key}`;
}

/**
 * Obter cliente S3 para brands/logos (mesmo bucket, pasta diferente)
 */
export const getBrandsS3Client = () => {
    return getS3Client(); // Wasabi usa o mesmo cliente, apenas pasta diferente
}
