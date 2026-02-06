import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client, getBrandsPublicUrl } from "../utils/s3";

/**
 * API Route para listar marcas/logos da Wasabi Storage
 *
 * Lista arquivos na pasta 'logo/' do bucket jobvarejo
 */

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const bucketName = config.wasabiBucket;

    if (!bucketName) {
        throw createError({
            statusCode: 500,
            statusMessage: "Wasabi bucket not configured (WASABI_BUCKET)"
        });
    }

    try {
        const s3Client = getS3Client();
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'logo/', // List items in logo/ folder
        });

        const response = await s3Client.send(command);

        const contents = response.Contents || [];

        // Map S3 objects to our asset format
        const brands = contents
            .filter(item => item.Key && !item.Key.endsWith('/')) // Filter out folders
            .map((item, index) => {
                // Extract clean name from Key - remove 'logo/' prefix
                const fileName = item.Key!.replace(/^logo\//, '');

                return {
                    id: item.ETag || `brand-${index}`,
                    url: getBrandsPublicUrl(fileName),
                    name: fileName,
                    lastModified: item.LastModified
                };
            })
            // Sort by name alphabetically
            .sort((a, b) => a.name.localeCompare(b.name));

        return brands;
    } catch (error) {
        console.error("List Brands Error from Wasabi:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list brands from Wasabi" });
    }
});
