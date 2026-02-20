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

// Refina o canal alpha para evitar bordas serrilhadas e remover artefatos.
// Inclui dilatação 3x3 para recuperar bordas do produto cortadas pelo modelo.
// PROTEGE pixels claros/brancos do produto (embalagens brancas, açúcar, leite, etc.)
const refineAlphaChannel = async (buffer: Buffer, sharp: any): Promise<Buffer> => {
    try {
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const w = info.width;
        const h = info.height;
        const totalPixels = w * h;

        // ──────────────────────────────────────────────
        // Passo 1: Extrair canal alpha original
        // ──────────────────────────────────────────────
        const alphaOrig = new Uint8Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
            alphaOrig[i] = data[i * 4 + 3] ?? 0;
        }

        // ──────────────────────────────────────────────
        // Passo 2: Dilatar alpha com filtro máximo 3x3
        //   Expande o foreground em 1 px para recuperar
        //   bordas de produto cortadas pelo modelo.
        // ──────────────────────────────────────────────
        const alphaDilated = new Uint8Array(totalPixels);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let maxA = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= h) continue;
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= w) continue;
                        const a = alphaOrig[ny * w + nx] ?? 0;
                        if (a > maxA) maxA = a;
                    }
                }
                alphaDilated[y * w + x] = maxA;
            }
        }

        // ──────────────────────────────────────────────
        // Passo 2.1: Fechar buracos pequenos (closing)
        //   Dilatação (acima) + erosão 3x3 (min) ajuda a
        //   reduzir "furos" internos (logos/textos) sem
        //   expandir muito as bordas do produto.
        // ──────────────────────────────────────────────
        const alphaClosed = new Uint8Array(totalPixels);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let minA = 255;
                for (let dy = -1; dy <= 1; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= h) continue;
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= w) continue;
                        const a = alphaDilated[ny * w + nx] ?? 0;
                        if (a < minA) minA = a;
                    }
                }
                alphaClosed[y * w + x] = minA;
            }
        }

        // ──────────────────────────────────────────────
        // Passo 3: Reconstruir alpha final conservador
        //   • Usa o maior entre original e 60 % do dilatado
        //     para recuperar bordas sem inventar foreground.
        //   • Threshold de corte baixo (alpha < 8) para
        //     não cortar bordas legítimas.
        //   • Zona de transição (8–80): pixels claros/brancos
        //     são tratados como provável produto.
        // ──────────────────────────────────────────────
        for (let i = 0; i < totalPixels; i++) {
            const px = i * 4;
            const r = data[px] ?? 0;
            const g = data[px + 1] ?? 0;
            const b = data[px + 2] ?? 0;
            const origA = alphaOrig[i] ?? 0;
            const dilA  = alphaDilated[i] ?? 0;
            const closedA = alphaClosed[i] ?? 0;

            // Mesclar: usar o maior entre original e 60 % do dilatado
            let alpha = Math.max(origA, Math.round(dilA * 0.6));

            // Preencher "furos" internos: se o pixel era quase transparente, mas o closing indica
            // forte presença de foreground ao redor, puxar alpha para cima de forma conservadora.
            if (origA < 30 && closedA > 140) {
                alpha = Math.max(alpha, Math.round(closedA * 0.7));
            }

            // Brilho do pixel (para proteger produto claro/branco)
            const brightness = (r + g + b) / 3;
            const isLight = brightness > 190;

            if (alpha < 8) {
                // Quase invisível mesmo após dilatação → transparente
                alpha = 0;
            } else if (alpha < 80) {
                // Zona de transição — ser conservador
                if (isLight && alpha >= 15) {
                    // Pixel claro com alpha razoável → provavelmente produto
                    alpha = Math.min(255, Math.round(alpha * 2.2));
                } else if (isLight) {
                    // Pixel claro com alpha muito baixo → manter suave
                    alpha = Math.min(255, Math.round(alpha * 1.5));
                } else {
                    // Pixel escuro em transição → manter com leve suavização
                    alpha = Math.max(0, alpha - 1);
                }
            }
            // alpha >= 80: manter como está (pixel sólido do produto)

            data[px + 3] = alpha;
        }

        return sharp(data, {
            raw: { width: w, height: h, channels: 4 }
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

/**
 * Processa imagem COM remoção de fundo obrigatória.
 * Diferente de processImage, este NÃO faz fallback silencioso.
 * Se a remoção de fundo falhar ou for pulada, lança um erro.
 */
export const processImageStrict = async (imageBuffer: Buffer): Promise<Buffer> => {
    return processImageWithOptions(imageBuffer, { strict: true });
};

type ProcessImageOptions = {
    outputFormat?: 'webp' | 'png';
    /** Se true, lança erro em vez de retornar imagem original quando bg removal falha */
    strict?: boolean;
    /** Se true, não pula a etapa de remoção mesmo quando já existe alpha parcial */
    forceBgRemoval?: boolean;
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

type AlphaStats = {
    totalPixels: number;
    transparentPixels: number;
    semiTransparentPixels: number;
    opaquePixels: number;
    transparentPercent: number;
    semiPercent: number;
    opaquePercent: number;
};

type AlphaShapeStats = {
    visiblePercent: number;
    opaquePercent: number;
    fillWithinBoundsPercent: number;
};

const getAlphaStats = async (buffer: Buffer, sharp: any): Promise<AlphaStats | null> => {
    try {
        const meta = await sharp(buffer).metadata();
        if (!meta.hasAlpha) return null;

        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const w = info.width;
        const h = info.height;
        const totalPixels = w * h;

        let transparentPixels = 0;
        let semiTransparentPixels = 0;
        let opaquePixels = 0;

        for (let i = 0; i < totalPixels; i++) {
            const a = data[i * 4 + 3];
            if (a < 8) transparentPixels++;
            else if (a < 250) semiTransparentPixels++;
            else opaquePixels++;
        }

        const transparentPercent = (transparentPixels / totalPixels) * 100;
        const semiPercent = (semiTransparentPixels / totalPixels) * 100;
        const opaquePercent = (opaquePixels / totalPixels) * 100;

        return {
            totalPixels,
            transparentPixels,
            semiTransparentPixels,
            opaquePixels,
            transparentPercent,
            semiPercent,
            opaquePercent
        };
    } catch {
        return null;
    }
};

const getAlphaShapeStats = async (buffer: Buffer, sharp: any): Promise<AlphaShapeStats | null> => {
    try {
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const height = info.height;
        const totalPixels = Math.max(1, width * height);
        let visiblePixels = 0;
        let opaquePixels = 0;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const a = data[(y * width + x) * 4 + 3] ?? 0;
                if (a < 16) continue;
                visiblePixels++;
                if (a >= 200) opaquePixels++;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (visiblePixels === 0 || maxX < minX || maxY < minY) {
            return {
                visiblePercent: 0,
                opaquePercent: 0,
                fillWithinBoundsPercent: 0
            };
        }

        const boundsArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
        return {
            visiblePercent: (visiblePixels / totalPixels) * 100,
            opaquePercent: (opaquePixels / totalPixels) * 100,
            fillWithinBoundsPercent: (visiblePixels / boundsArea) * 100
        };
    } catch {
        return null;
    }
};

const isOverAggressiveRemoval = (alphaStats: AlphaStats | null, shapeStats: AlphaShapeStats | null) => {
    if (!alphaStats || !shapeStats) return { aggressive: false, reason: '' };

    const visiblePercent = shapeStats.visiblePercent;
    const opaquePercent = shapeStats.opaquePercent;
    const fillWithinBoundsPercent = shapeStats.fillWithinBoundsPercent;

    const almostEmpty = visiblePercent < 6 || opaquePercent < 1.4;
    const sparseSubject = visiblePercent < 12 && opaquePercent < 3.2;
    const ghostCutout =
        visiblePercent < 20 &&
        opaquePercent < 2.2 &&
        fillWithinBoundsPercent < 42;
    const hollowCutout =
        visiblePercent < 24 &&
        fillWithinBoundsPercent < 24 &&
        alphaStats.transparentPercent > 78;

    if (almostEmpty || sparseSubject || ghostCutout || hollowCutout) {
        return {
            aggressive: true,
            reason: `visível=${visiblePercent.toFixed(1)}%, opaco=${opaquePercent.toFixed(1)}%, preenchimento=${fillWithinBoundsPercent.toFixed(1)}%, transparente=${alphaStats.transparentPercent.toFixed(1)}%`
        };
    }

    return { aggressive: false, reason: '' };
};

const shouldSkipBackgroundRemoval = async (buffer: Buffer, sharp: any): Promise<boolean> => {
    const stats = await getAlphaStats(buffer, sharp);
    if (!stats) return false;

    // If the image already has a meaningful transparent background, background-removal is likely to
    // degrade quality (punch holes in logos/text). In this case, keep the original alpha.
    //
    // Heuristic:
    // - Transparent background cutouts typically have a large percentage of fully transparent pixels.
    // - Small transparency around edges should not trigger the skip.
    const totalTransparent = stats.transparentPercent + stats.semiPercent;
    // Thresholds mais altos para evitar falsos positivos.
    // Muitas imagens de produto do Google têm PNG com leve transparência
    // em artefatos de compressão, mas ainda têm fundo branco visível.
    const hasMeaningfulTransparency =
        stats.transparentPercent >= 25 ||
        (stats.transparentPercent >= 15 && totalTransparent >= 25);

    if (hasMeaningfulTransparency) {
        console.log(
            `🧠 [Image Process] Skip BG removal: alpha already present (transparent=${stats.transparentPercent.toFixed(1)}%, semi=${stats.semiPercent.toFixed(1)}%)`
        );
        return true;
    }

    return false;
};

const isMostlyLightLowContrast = async (buffer: Buffer, sharp: any): Promise<boolean> => {
    try {
        const st = await sharp(buffer).stats();
        const mean = ((st.channels?.[0]?.mean || 0) + (st.channels?.[1]?.mean || 0) + (st.channels?.[2]?.mean || 0)) / 3;
        const stdev = ((st.channels?.[0]?.stdev || 0) + (st.channels?.[1]?.stdev || 0) + (st.channels?.[2]?.stdev || 0)) / 3;
        // Very bright + low contrast images are risky: the model may erase a white/light subject.
        return mean >= 220 && stdev <= 35;
    } catch {
        return false;
    }
};

export const processImageWithOptions = async (imageBuffer: Buffer, options: ProcessImageOptions = {}) => {
    const sharp = await getSharp();
    const outputFormat: 'webp' | 'png' = options.outputFormat || 'webp';
    const bgOptions = options.bgRemoval || {};
    const strictMode = options.strict === true;
    const forceBgRemoval = options.forceBgRemoval === true;

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
        // 1.5. If input already has transparency, we may skip to avoid degrading cutouts.
        // In "forceBgRemoval" mode (used by explicit "remove background" action), always process.
        const shouldSkip = await shouldSkipBackgroundRemoval(resizedBuffer, sharp);
        if (shouldSkip && !forceBgRemoval) {
            const passthrough = outputFormat === 'png'
                ? await sharp(resizedBuffer).png().toBuffer()
                : await sharp(resizedBuffer).webp({ quality: 85, alphaQuality: 100 }).toBuffer();
            return passthrough;
        }
        if (shouldSkip && forceBgRemoval) {
            console.log('🧠 [Image Process] forceBgRemoval ativo: executando remoção mesmo com alpha pré-existente');
        }

        const lightRisk = await isMostlyLightLowContrast(resizedBuffer, sharp);
        if (lightRisk) {
            console.log('🧠 [Image Process] Detecção: imagem muito clara/baixo contraste — remoção de fundo pode ser agressiva');
        }

        // 2. Remove Background usando configurações refinadas
        console.log('🎨 [Image Process] Removendo fundo da imagem...');
        const blob = new Blob([resizedBuffer], { type: 'image/png' });

        const removeBackground = await getRemoveBackground();

        // Configurações refinadas - modelo 'medium' tem melhor separação
        // entre produto e fundo, especialmente para produtos claros/brancos
        const modelType = bgOptions.model || (lightRisk ? 'large' : 'medium');
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

        const outStats = await getAlphaStats(refinedBuffer, sharp);

        // Additional guard for very light/low contrast images: if the result is mostly transparent,
        // prefer returning the original (better than deleting the subject).
        if (lightRisk) {
            if (outStats) {
                const visiblePercent = 100 - outStats.transparentPercent;
                if (visiblePercent < 10 || outStats.opaquePercent < 2) {
                    console.warn(
                        `⚠️ [Image Process] Resultado muito transparente em imagem clara (visível=${visiblePercent.toFixed(1)}%, opaco=${outStats.opaquePercent.toFixed(1)}%) — fallback`
                    );
                    const fallbackPipeline = sharp(imageBuffer).resize(800, 800, { fit: 'inside', withoutEnlargement: true });
                    const fallbackBuffer = outputFormat === 'png'
                        ? await fallbackPipeline.png().toBuffer()
                        : await fallbackPipeline.webp({ quality: 85 }).toBuffer();
                    if (strictMode) {
                        throw new Error('[Image Process][STRICT] Resultado muito transparente após remoção de fundo');
                    }
                    return fallbackBuffer;
                }
            }
        }

        // Guard geral para evitar "furos" agressivos no produto.
        const shapeStats = await getAlphaShapeStats(refinedBuffer, sharp);
        const aggressive = isOverAggressiveRemoval(outStats, shapeStats);
        if (aggressive.aggressive) {
            console.warn(`⚠️ [Image Process] Resultado agressivo de remoção detectado (${aggressive.reason})`);
            if (strictMode) {
                throw new Error(`[Image Process][STRICT] Remoção agressiva detectada: ${aggressive.reason}`);
            }
            const fallbackPipeline = sharp(imageBuffer).resize(800, 800, { fit: 'inside', withoutEnlargement: true });
            const fallbackBuffer = outputFormat === 'png'
                ? await fallbackPipeline.png().toBuffer()
                : await fallbackPipeline.webp({ quality: 85 }).toBuffer();
            return fallbackBuffer;
        }

        // Em modo estrito, exigir transparência real no resultado para evitar sucesso falso.
        if (strictMode) {
            const transparentLike = outStats ? (outStats.transparentPercent + outStats.semiPercent) : 0;
            if (!outStats || transparentLike < 2) {
                throw new Error('[Image Process][STRICT] Remoção de fundo não gerou transparência detectável');
            }
            if (shapeStats) {
                if (shapeStats.visiblePercent < 7 || shapeStats.opaquePercent < 2) {
                    throw new Error(
                        `[Image Process][STRICT] Produto ficou pequeno/diluído demais após recorte (visível=${shapeStats.visiblePercent.toFixed(1)}%, opaco=${shapeStats.opaquePercent.toFixed(1)}%)`
                    );
                }
                if (shapeStats.visiblePercent < 22 && shapeStats.fillWithinBoundsPercent < 18) {
                    throw new Error(
                        `[Image Process][STRICT] Recorte com furos excessivos detectado (preenchimento=${shapeStats.fillWithinBoundsPercent.toFixed(1)}%)`
                    );
                }
            }
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
        
        // Em modo strict, NÃO fazer fallback — propagar o erro
        if (strictMode) {
            throw new Error(`[Image Process][STRICT] Falha na remoção de fundo: ${error?.message || error}`);
        }
        
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

const getDownloadTimeoutSignal = (timeoutMs: number): AbortSignal | undefined => {
    const timeoutFactory = (AbortSignal as any)?.timeout;
    if (typeof timeoutFactory !== 'function') return undefined;
    return timeoutFactory(timeoutMs);
};

export const downloadImage = async (
    url: string,
    opts: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<Buffer> => {
    const maxBytes = Number.isFinite(opts.maxBytes) ? Math.max(32_768, Number(opts.maxBytes)) : 12 * 1024 * 1024;
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? Math.max(1_000, Number(opts.timeoutMs)) : 15_000;
    const response = await fetch(url, { signal: getDownloadTimeoutSignal(timeoutMs) });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const contentLength = Number.parseInt(String(response.headers.get('content-length') || ''), 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error('Image too large');
    }

    if (!response.body?.getReader) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) throw new Error('Image too large');
        return Buffer.from(arrayBuffer);
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value || new Uint8Array());
        total += chunk.length;
        if (total > maxBytes) {
            try { await reader.cancel(); } catch { /* ignore */ }
            throw new Error('Image too large');
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
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
