import { S3Client } from "@aws-sdk/client-s3";

export const getS3Client = () => {
    const config = useRuntimeConfig();
    const endpoint = config.contaboEndpoint;
    const region = config.contaboRegion || "default";
    const accessKeyId = config.contaboAccessKey;
    const secretAccessKey = config.contaboSecretKey;

    if (!accessKeyId || !secretAccessKey || !endpoint) {
        throw createError({
            statusCode: 500,
            statusMessage: "Contabo Storage configuration missing"
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
