import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getS3Client, getPublicUrl } from "../utils/s3";

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const bucketName = config.contaboBucket;

    try {
        const s3Client = getS3Client();
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'uploads/', // Only list items in uploads folder
        });

        const response = await s3Client.send(command);
        
        const contents = response.Contents || [];

        // Map S3 objects to our asset format
        const uploads = contents
            .filter(item => item.Key && !item.Key.endsWith('/')) // Filter out folders if any
            .filter(item => !String(item.Key).startsWith('uploads/bg-removed-')) // Hide derived assets from list
            .map((item, index) => {
                // Extract clean name from Key (uploads/timestamp-filename.ext)
                const keyParts = item.Key!.split('/');
                const fileName = keyParts[keyParts.length - 1];
                // Remove timestamp prefix if present (13 digits + dash)
                const cleanName = fileName.replace(/^\d+-/, '');

                return {
                    id: item.ETag || `s3-${index}`, // Use ETag as stable ID if possible
                    url: getPublicUrl(item.Key!),
                    name: cleanName,
                    folderId: null, // Default to root of uploads
                    lastModified: item.LastModified
                };
            })
            // Sort by newest first
            .sort((a, b) => {
                const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
                const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
                return dateB - dateA;
            });

        return uploads;
    } catch (error) {
        console.error("List Uploads Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list uploads from Contabo" });
    }
});
