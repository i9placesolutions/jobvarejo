import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

export const processImage = async (imageBuffer: Buffer) => {
    try {
        // 1. Resize/Normalize (to max 800x800) and convert to PNG
        const resizedBuffer = await sharp(imageBuffer)
            .resize(800, 800, { 
                fit: 'inside', 
                withoutEnlargement: true,
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent padding if needed, but 'inside' avoids it
            })
            .png()
            .toBuffer();
        
        // 2. Remove Background using @imgly/background-removal-node
        // It expects a MIME type when using Blob.
        const blob = new Blob([resizedBuffer], { type: 'image/png' });
        
        // Config: publicPath might be needed to locate wasm files if not resolved automatically.
        // Usually works out of the box in Node.
        // We set progress to false to avoid console spam
        const rbResult = await removeBackground(blob, {
            progress: (key, current, total) => {},
            debug: false
        });
        
        const rbBuffer = Buffer.from(await rbResult.arrayBuffer());

        // 3. Optimize to WebP
        const finalBuffer = await sharp(rbBuffer)
            .webp({ quality: 85 })
            .toBuffer();

        return finalBuffer;
    } catch (error) {
        console.error("Image Processing Error:", error);
        throw error;
    }
};

export const downloadImage = async (url: string): Promise<Buffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
