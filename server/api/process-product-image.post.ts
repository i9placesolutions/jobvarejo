import { ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client, getPublicUrl } from "../utils/s3";
import { processImage, downloadImage } from "../utils/image-processor";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { term } = body; // e.g., "Arroz Tio João 5kg"

    if (!term) {
        throw createError({ statusCode: 400, statusMessage: "Search term required" });
    }

    const config = useRuntimeConfig();
    const s3 = getS3Client();
    const bucketName = config.contaboBucket;
    
    // Normalize term for search
    const normalizedTerm = term.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Internal Search (Contabo S3)
    try {
        // List objects in uploads/ to find match
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'uploads/',
            MaxKeys: 1000
        });
        
        const data = await s3.send(listCommand);
        if (data.Contents) {
            const match = data.Contents.find(item => {
                if(!item.Key) return false;
                // Decode and normalize filename for matching
                const decodedKey = decodeURIComponent(item.Key);
                const normalizedKey = decodedKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                // Simple inclusion check
                return normalizedKey.includes(normalizedTerm);
            });
            
            if (match && match.Key) {
                // Generate pre-signed URL (valid for 1 hour)
                // ChecksumMode DISABLED for S3-compatible storage (e.g. Contabo) that may return 500
                const getCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: match.Key,
                    ChecksumMode: 'DISABLED'
                });
                const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
                
                return {
                    source: 'internal',
                    url: signedUrl
                };
            }
        }
    } catch (err) {
        console.warn("Internal search failed:", err);
        // Continue to external
    }

    // 2. External Search (Serper.dev)
    if (!config.serperApiKey) {
        throw createError({ statusCode: 500, statusMessage: "Serper API Key missing" });
    }

    let imageUrl = '';
    try {
        const response = await fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
                'X-API-KEY': config.serperApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: term,
                gl: 'br', // Brazil localization
                hl: 'pt-br'
            })
        });
        
        const result = await response.json();
        if (result.images && result.images.length > 0) {
            // Pick first valid image (maybe try a few?)
            imageUrl = result.images[0].imageUrl;
        }
    } catch (err) {
        console.error("Serper API error:", err);
        throw createError({ statusCode: 500, statusMessage: "External search failed" });
    }

    if (!imageUrl) {
        throw createError({ statusCode: 404, statusMessage: "No image found" });
    }

    // 3. Process Pipeline
    try {
        // Download
        const rawBuffer = await downloadImage(imageUrl);
        
        // Resize + Remove BG + Optimize
        const processedBuffer = await processImage(rawBuffer);
        
        // Upload to S3
        const timestamp = Date.now();
        const safeName = term.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
        const key = `uploads/smart-${safeName}-${timestamp}.webp`;
        
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: 'image/webp',
            ACL: 'public-read'
        });
        
        await s3.send(putCommand);
        
        // Generate pre-signed URL for the new upload
        // ChecksumMode DISABLED for S3-compatible storage (e.g. Contabo) that may return 500
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
            ChecksumMode: 'DISABLED'
        });
        const finalUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 });
        
        return {
            source: 'external',
            processing: 'processed',
            url: finalUrl
        };

    } catch (err: any) {
        console.error("Processing pipeline failed:", err);
        throw createError({ statusCode: 500, statusMessage: "Failed to process image", message: err.message });
    }
});
