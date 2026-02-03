import { S3Client } from "@aws-sdk/client-s3";

export const getS3Client = () => {
    const config = useRuntimeConfig();
    const endpoint = config.contaboEndpoint;
    const region = config.contaboRegion || "default";
    const accessKeyId = config.contaboAccessKey;
    const secretAccessKey = config.contaboSecretKey;

    if (!accessKeyId || !secretAccessKey || !endpoint) {
        const missing: string[] = []
        if (!endpoint) missing.push('CONTABO_ENDPOINT')
        if (!accessKeyId) missing.push('CONTABO_ACCESS_KEY')
        if (!secretAccessKey) missing.push('CONTABO_SECRET_KEY')

        throw createError({
            statusCode: 500,
            statusMessage: `Contabo Storage configuration missing (${missing.join(', ')})`
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
    return `https://${config.contaboEndpoint}/${config.contaboBucket}/${key}`;
}

export const getBrandsPublicUrl = (key: string) => {
    const config = useRuntimeConfig();
    return `https://${config.contaboEndpoint}/${config.contaboBrandsBucket}/${key}`;
}
