import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client } from "../utils/s3";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * API Route para listar marcas/logos da Wasabi Storage
 *
 * Lista arquivos na pasta 'logo/' do bucket jobvarejo
 * Retorna URLs via proxy interno para evitar expor links assinados no frontend.
 */

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `brands-list:${user.id}`, 120, 60_000)
    const config = useRuntimeConfig();
    const bucketName = config.wasabiBucket;
    const toProxyUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`;

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
            MaxKeys: 1000
        });

        const response = await s3Client.send(command);

        const contents = response.Contents || [];

        // Map S3 objects to our asset format with proxy URLs
        const brands = contents
            .filter(item => item.Key && !item.Key.endsWith('/')) // Filter out folders
            .map((item, index) => {
                const fileName = item.Key!.replace(/^logo\//, '');

                return {
                    id: item.ETag || `brand-${index}`,
                    url: toProxyUrl(item.Key!),
                    name: fileName,
                    lastModified: item.LastModified
                };
            });

        // Sort by name alphabetically
        brands.sort((a, b) => a.name.localeCompare(b.name));

        return brands;
    } catch (error) {
        console.error("List Brands Error from Wasabi:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list brands from Wasabi" });
    }
});
