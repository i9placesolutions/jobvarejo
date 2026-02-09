import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../utils/s3";

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const bucketName = config.wasabiBucket;

    try {
        const s3Client = getS3Client();
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'uploads/', // Only list items in uploads folder
        });

        const response = await s3Client.send(command);
        
        const contents = response.Contents || [];

        // Map S3 objects to our asset format with presigned URLs
        const uploads = await Promise.all(
            contents
                .filter(item => item.Key && !item.Key.endsWith('/')) // Filter out folders if any
                .filter(item => !String(item.Key).startsWith('uploads/bg-removed-')) // Hide derived assets from list
                .map(async (item, index) => {
                    const keyParts = item.Key!.split('/');
                    const fileName = keyParts[keyParts.length - 1] || '';
                    const cleanName = fileName.replace(/^\d+-/, '');

                    // Generate pre-signed URL (valid for 1 hour)
                    const getCommand = new GetObjectCommand({
                        Bucket: bucketName,
                        Key: item.Key!
                    });
                    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

                    return {
                        id: item.ETag || `s3-${index}`,
                        url: signedUrl,
                        name: cleanName,
                        folderId: null,
                        lastModified: item.LastModified
                    };
                })
        );

        // Sort by newest first
        uploads.sort((a, b) => {
            const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return dateB - dateA;
        });

        return uploads;
    } catch (error) {
        console.error("List Uploads Error:", error);
        throw createError({ statusCode: 500, statusMessage: "Failed to list uploads from Wasabi" });
    }
});
