// Lazy load both sharp and background-removal to handle installation issues
let sharpModule: any = null;
let removeBackgroundModule: any = null;
let sharpError: Error | null = null;

const getSharp = async () => {
    if (sharpError) {
        throw sharpError;
    }
    if (!sharpModule) {
        try {
            sharpModule = (await import('sharp')).default;
        } catch (error: any) {
            sharpError = new Error('Sharp não está instalado corretamente. Execute: npm install sharp');
            console.error('⚠️ Sharp não está disponível. Processamento de imagem será limitado.');
            console.error('   Erro:', error?.message || error);
            throw sharpError;
        }
    }
    return sharpModule;
};

const getRemoveBackground = async () => {
    if (!removeBackgroundModule) {
        try {
            const module = await import('@imgly/background-removal-node');
            removeBackgroundModule = module.removeBackground;
        } catch (error: any) {
            console.error('⚠️ Background removal não está disponível.');
            console.error('   Erro:', error?.message || error);
            throw new Error('Background removal não está instalado corretamente.');
        }
    }
    return removeBackgroundModule;
};

// Refina o canal alpha para evitar bordas serrilhadas e remover artefatos
// PROTEGE pixels claros/brancos do produto (não confundir com fundo branco)
const refineAlphaChannel = async (buffer: Buffer, sharp: any): Promise<Buffer> => {
    try {
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const feather = 1; // Leve suavização nas bordas

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const alpha = data[i + 3];

            // Verificar se o pixel é claro/branco (potencialmente parte do produto)
            const brightness = (r + g + b) / 3;
            const isLightPixel = brightness > 200;

            // Pixels com alpha muito baixo (0-25)
            if (alpha > 0 && alpha < 25) {
                // Se for um pixel claro/branco com alpha baixo, pode ser parte do produto
                // que o modelo marcou erroneamente como fundo. Ser mais conservador.
                if (isLightPixel) {
                    // Manter com alpha reduzido mas não eliminar completamente
                    // Isso preserva bordas brancas de embalagens
                    data[i + 3] = 0; // Ainda remover, pois alpha < 25 é muito baixo
                } else {
                    data[i + 3] = 0;
                }
            }
            // Pixels com alpha médio (25-100) - zona de transição
            else if (alpha >= 25 && alpha < 100) {
                if (isLightPixel && alpha >= 40) {
                    // Pixel claro com alpha razoável: PRESERVAR mais (provavelmente é produto)
                    // Aumentar alpha para evitar que produto branco fique semi-transparente
                    data[i + 3] = Math.min(255, Math.round(alpha * 1.8));
                } else if (isLightPixel) {
                    // Pixel claro com alpha baixo: manter com leve redução
                    data[i + 3] = Math.max(0, alpha - feather);
                } else {
                    // Pixel escuro com alpha médio: aplicar feather normal
                    data[i + 3] = Math.max(0, Math.min(255, alpha - feather * 2));
                }
            }
            // Alpha >= 100: manter como está (pixel sólido do produto)
        }

        return sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4
            }
        }).png().toBuffer();
    } catch (e) {
        console.warn('⚠️ [Alpha Refine] Erro ao refinar alpha:', e);
        return buffer; // Retornar original se falhar
    }
};

// Valida se a imagem resultante tem conteúdo visível (não totalmente transparente)
const validateImageHasContent = async (buffer: Buffer, sharp: any): Promise<boolean> => {
    try {
        const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
        
        let opaquePixels = 0;
        let semiTransparentPixels = 0;
        const totalPixels = info.width * info.height;
        
        // Check alpha channel (every 4th byte starting at index 3 for RGBA)
        if (info.channels === 4) {
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 128) opaquePixels++;
                else if (data[i] > 10) semiTransparentPixels++;
            }
        } else {
            // No alpha channel = all pixels are opaque
            return true;
        }
        
        const opaquePercent = (opaquePixels / totalPixels) * 100;
        const semiPercent = (semiTransparentPixels / totalPixels) * 100;
        const visiblePercent = ((opaquePixels + semiTransparentPixels) / totalPixels) * 100;
        console.log(`📊 [Image Validate] Opacos: ${opaquePercent.toFixed(1)}%, Semi: ${semiPercent.toFixed(1)}%, Total visível: ${visiblePercent.toFixed(1)}%`);
        
        // Considerar válida se pelo menos 3% de pixels são visíveis
        // (produtos brancos em fundo branco podem ter resultado com poucos pixels)
        return visiblePercent > 3;
    } catch (e) {
        console.warn('⚠️ [Image Validate] Erro ao validar imagem:', e);
        return true; // Assume it's valid if we can't check
    }
};

export const processImage = async (imageBuffer: Buffer) => {
    return processImageWithOptions(imageBuffer, {});
};

type ProcessImageOptions = {
    outputFormat?: 'webp' | 'png';
    // Opções de refinamento do removedor de fundo
    bgRemoval?: {
        model?: 'small' | 'medium' | 'large';
        // Threshold de confiança (0-1). Maior = mais conservador (remove menos)
        confidenceThreshold?: number;
        // Suavizar bordas (feather) em pixels
        featherRadius?: number;
        // Tolerância para cores semelhantes ao fundo
        colorTolerance?: number;
    };
};

export const processImageWithOptions = async (imageBuffer: Buffer, options: ProcessImageOptions = {}) => {
    const sharp = await getSharp();
    const outputFormat: 'webp' | 'png' = options.outputFormat || 'webp';
    const bgOptions = options.bgRemoval || {};

    console.log('🖼️ [Image Process] Iniciando processamento de imagem...');
    console.log(`📊 [Image Process] Buffer original: ${imageBuffer.length} bytes`);

    // 1. Resize/Normalize (to max 800x800) mantendo transparência original
    console.log('📐 [Image Process] Redimensionando para max 800x800...');
    const resizePipeline = sharp(imageBuffer).resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
    });

    // NÃO flatten - preservar transparência/original para melhor detecção
    const resizedBuffer = await resizePipeline.png().toBuffer();

    const resizedMeta = await sharp(resizedBuffer).metadata();
    console.log(`📊 [Image Process] Após resize: ${resizedBuffer.length} bytes, ${resizedMeta.width}x${resizedMeta.height}`);

    try {
        // 2. Remove Background usando configurações refinadas
        console.log('🎨 [Image Process] Removendo fundo da imagem...');
        const blob = new Blob([resizedBuffer], { type: 'image/png' });

        const removeBackground = await getRemoveBackground();

        // Configurações refinadas - modelo 'medium' tem melhor separação
        // entre produto e fundo, especialmente para produtos claros/brancos
        const modelType = bgOptions.model || 'medium';
        console.log(`   📐 Modelo: ${modelType}`);

        const rbResult = await removeBackground(blob, {
            progress: (key: string, current: number, total: number) => {
                if (current === total) console.log(`   ✓ ${key} concluído`);
            },
            debug: false,
            model: modelType,
            output: {
                format: 'image/png',
                type: 'foreground',
                quality: 0.9
            }
        });

        const rbBuffer = Buffer.from(await rbResult.arrayBuffer());
        console.log(`📊 [Image Process] Após remoção de fundo: ${rbBuffer.length} bytes`);

        // 2.5. Refinar canal alpha para remover artefatos e melhorar bordas
        console.log('✨ [Image Process] Refinando canal alpha...');
        const refinedBuffer = await refineAlphaChannel(rbBuffer, sharp);
        console.log(`📊 [Image Process] Após refino: ${refinedBuffer.length} bytes`);

        // Validate that the result has actual content
        const hasContent = await validateImageHasContent(refinedBuffer, sharp);
        
        if (!hasContent) {
            console.warn('⚠️ [Image Process] Imagem resultante está vazia/transparente! Retornando original otimizada...');
            // Return optimized original without background removal
            const fallbackPipeline = sharp(imageBuffer).resize(800, 800, { fit: 'inside', withoutEnlargement: true });
            const fallbackBuffer = outputFormat === 'png'
                ? await fallbackPipeline.png().toBuffer()
                : await fallbackPipeline.webp({ quality: 85 }).toBuffer();
            return fallbackBuffer;
        }

        console.log('✅ [Image Process] Fundo removido com sucesso!');

        // 3. Optimize output (preserve alpha) - usar buffer refinado
        if (outputFormat === 'png') {
            console.log('📦 [Image Process] Otimizando para PNG...');
            const finalPng = await sharp(refinedBuffer).png().toBuffer();
            console.log(`✅ [Image Process] Imagem processada: ${finalPng.length} bytes`);
            return finalPng;
        }

        console.log('📦 [Image Process] Otimizando para WebP...');
        const finalWebp = await sharp(refinedBuffer).webp({ quality: 85, alphaQuality: 100 }).toBuffer();

        console.log(`✅ [Image Process] Imagem processada: ${finalWebp.length} bytes`);
        return finalWebp;
        
    } catch (error: any) {
        console.error('❌ [Image Process] Erro na remoção de fundo:', error?.message || error);
        
        // Fallback: return resized and optimized original
        console.warn('⚠️ [Image Process] Aplicando fallback (sem remoção de fundo)...');
        const fallbackPipeline = sharp(imageBuffer).resize(800, 800, { fit: 'inside', withoutEnlargement: true });
        const fallbackBuffer = outputFormat === 'png'
            ? await fallbackPipeline.png().toBuffer()
            : await fallbackPipeline.webp({ quality: 85 }).toBuffer();
        console.log(`✅ [Image Process] Fallback aplicado: ${fallbackBuffer.length} bytes`);
        return fallbackBuffer;
    }
};

export const downloadImage = async (url: string): Promise<Buffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export const createBlankPng = async (width: number, height: number, opts: { transparent?: boolean } = {}): Promise<Buffer> => {
    const sharp = await getSharp();
    const w = Math.max(1, Math.floor(Number(width) || 1));
    const h = Math.max(1, Math.floor(Number(height) || 1));
    const transparent = opts.transparent !== false;
    const background = transparent
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 255, g: 255, b: 255, alpha: 1 };
    return sharp({
        create: {
            width: w,
            height: h,
            channels: 4,
            background
        }
    })
        .png()
        .toBuffer();
}
