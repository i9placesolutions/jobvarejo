import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client, getBrandsPublicUrl } from "../utils/s3";

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const brandsBucket = config.contaboBrandsBucket;

    if (!brandsBucket) {
        throw createError({
            statusCode: 500,
            statusMessage: "Brands bucket not configured (CONTABO_BRANDS_BUCKET)"
        });
    }

    try {
        const s3Client = getS3Client();
        const command = new ListObjectsV2Command({
            Bucket: brandsBucket,
            Prefix: '', // List all items in brands bucket
        });

        const response = await s3Client.send(command);

        const contents = response.Contents || [];

        // Map S3 objects to our asset format
        const brands = contents
            .filter(item => item.Key && !item.Key.endsWith('/')) // Filter out folders if any
            .map((item, index) => {
                // Extract clean name from Key
                const fileName = item.Key!;

                return {
                    id: item.ETag || `brand-${index}`,
                    url: getBrandsPublicUrl(item.Key!),
                    name: fileName,
                    lastModified: item.LastModified
                };
            })
            // Sort by name alphabetically
            .sort((a, b) => a.name.localeCompare(b.name));

        return brands;
    } catch (error) {
        console.error("List Brands Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list brands from Contabo" });
    }
});
