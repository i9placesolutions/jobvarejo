import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client } from "../utils/s3";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `uploads-list:${user.id}`, 120, 60_000)
    const config = useRuntimeConfig();
    const bucketName = config.wasabiBucket;
    const toProxyUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`;
    if (!bucketName) {
        throw createError({ statusCode: 500, statusMessage: "Wasabi bucket not configured (WASABI_BUCKET)" });
    }

    const query = getQuery(event)
    const requestedLimit = Number.parseInt(String(query.limit ?? ''), 10)
    const limit = Number.isFinite(requestedLimit) ? clamp(requestedLimit, 1, 1000) : 400

    try {
        const s3Client = getS3Client();
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'uploads/', // Only list items in uploads folder
            MaxKeys: 1000
        });

        const response = await s3Client.send(command);
        
        const contents = response.Contents || [];

        // Map S3 objects to our asset format with proxy URLs
        const uploads = contents
            .filter(item => item.Key && !item.Key.endsWith('/')) // Filter out folders if any
            .filter(item => !String(item.Key).startsWith('uploads/bg-removed-')) // Hide derived assets from list
            .map((item, index) => {
                const keyParts = item.Key!.split('/');
                const fileName = keyParts[keyParts.length - 1] || '';
                const cleanName = fileName.replace(/^\d+-/, '');

                return {
                    id: item.ETag || `s3-${index}`,
                    url: toProxyUrl(item.Key!),
                    name: cleanName,
                    folderId: null,
                    lastModified: item.LastModified
                };
            });

        // Sort by newest first
        uploads.sort((a, b) => {
            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return dateB - dateA;
        });

        return uploads.slice(0, limit);
    } catch (error) {
        console.error("List Uploads Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list uploads from Wasabi" });
    }
});
