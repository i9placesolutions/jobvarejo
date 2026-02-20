import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { processImageWithOptions, downloadImage } from "~/server/utils/image-processor";
import { getS3Client } from "~/server/utils/s3";
import { openAiEditImage } from "~/server/utils/openai-images";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { assertSafeExternalHttpUrl } from "../utils/url-safety";

const KEY_PREFIXES = ["projects/", "imagens/", "uploads/", "logo/"];
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_LENGTH = 12_000_000;

const streamToBuffer = async (body: any): Promise<Buffer> => {
    if (!body) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;

    if (typeof body.transformToByteArray === "function") {
        const arr = await body.transformToByteArray();
        return Buffer.from(arr);
    }
    if (typeof body.arrayBuffer === "function") {
        const ab = await body.arrayBuffer();
        return Buffer.from(ab);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of body as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

const getNumericStatus = (err: any): number | null => {
    const raw = Number(err?.statusCode || err?.status || err?.$metadata?.httpStatusCode || 0);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw;
};

const getErrorMessage = (err: any): string => {
    const msg = String(err?.statusMessage || err?.message || err?.cause?.message || "").trim();
    if (msg) return msg;
    return "Failed to remove background";
};

const isAwsNoSuchKey = (err: any): boolean => {
    const name = String(err?.name || err?.Code || "").toLowerCase();
    return name === "nosuchkey" || getNumericStatus(err) === 404;
};

const isAwsAccessDenied = (err: any): boolean => {
    const name = String(err?.name || err?.Code || "").toLowerCase();
    return (
        name === "accessdenied" ||
        name === "invalidaccesskeyid" ||
        name === "signaturedoesnotmatch" ||
        getNumericStatus(err) === 401 ||
        getNumericStatus(err) === 403
    );
};

const isLikelyTimeout = (err: any): boolean => {
    const msg = getErrorMessage(err).toLowerCase();
    return (
        msg.includes("timed out") ||
        msg.includes("timeout") ||
        msg.includes("abort") ||
        msg.includes("econnreset") ||
        msg.includes("etimedout")
    );
};

const mapRemoveBgError = (err: any) => {
    const status = getNumericStatus(err);
    if (status) return err;

    const msg = getErrorMessage(err);
    const lower = msg.toLowerCase();

    if (isAwsNoSuchKey(err)) {
        return createError({ statusCode: 404, statusMessage: "Source image not found in storage", message: msg });
    }
    if (isAwsAccessDenied(err)) {
        return createError({ statusCode: 502, statusMessage: "Storage access denied", message: msg });
    }
    if (isLikelyTimeout(err)) {
        return createError({ statusCode: 504, statusMessage: "Upstream timeout while processing image", message: msg });
    }
    if (lower.includes("image too large")) {
        return createError({ statusCode: 413, statusMessage: "Source image exceeds size limit", message: msg });
    }
    if (lower.includes("failed to fetch image")) {
        return createError({ statusCode: 422, statusMessage: "Could not download source image", message: msg });
    }
    if (lower.includes("[image process][strict]") || lower.includes("background removal failed")) {
        return createError({ statusCode: 422, statusMessage: "Background removal failed", message: msg });
    }

    return null;
};

const isStorageProxyPath = (pathname: string): boolean => {
    const normalized = String(pathname || '').trim();
    return /\/api\/storage\/(?:proxy|p)\/?$/i.test(normalized);
};

const extractProxyKeyFromUrl = (rawUrl: string): string | null => {
    try {
        const decoded = decodeURIComponent(rawUrl);
        const urlObj = decoded.startsWith("http://") || decoded.startsWith("https://")
            ? new URL(decoded)
            : new URL(decoded, "http://local");
        if (!isStorageProxyPath(urlObj.pathname)) return null;
        const key = urlObj.searchParams.get("key");
        return key ? decodeURIComponent(key) : null;
    } catch {
        return null;
    }
};

const extractDirectKey = (rawUrl: string): string | null => {
    try {
        const decoded = decodeURIComponent(rawUrl).trim().replace(/^\/+/, "");
        if (!decoded) return null;
        return KEY_PREFIXES.some((p) => decoded.startsWith(p)) ? decoded : null;
    } catch {
        return null;
    }
};

const extractWasabiKeyFromUrl = (rawUrl: string, bucketName: string): string | null => {
    try {
        const decoded = decodeURIComponent(rawUrl);
        const urlObj = decoded.startsWith("http://") || decoded.startsWith("https://")
            ? new URL(decoded)
            : new URL(decoded, "http://local");
        const pathParts = decodeURIComponent(urlObj.pathname).split('/').filter(Boolean);
        if (pathParts.length === 0) return null;

        // Path-style: /<bucket>/<key...>
        if (pathParts[0] === bucketName) {
            return pathParts.slice(1).join('/');
        }

        // Virtual-host style: https://<bucket>.<endpoint>/<key...>
        const host = urlObj.hostname;
        if (host.startsWith(`${bucketName}.`)) {
            return pathParts.join('/');
        }

        return null;
    } catch {
        return null;
    }
};

const extractAnyKey = (rawUrl: string, bucketName: string): string | null => {
    return extractProxyKeyFromUrl(rawUrl) || extractWasabiKeyFromUrl(rawUrl, bucketName) || extractDirectKey(rawUrl);
};

const isAllowedStorageKey = (value: string): boolean => {
    const key = String(value || '').trim().replace(/^\/+/, '');
    return KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
};

const normalizeSourceKey = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        return decodeURIComponent(trimmed).replace(/^\/+/, '');
    } catch {
        return trimmed.replace(/^\/+/, '');
    }
};

const isSameOriginStorageProxyUrl = (rawUrl: string, event: any): boolean => {
    try {
        const reqUrl = getRequestURL(event);
        const parsed = new URL(rawUrl, reqUrl.origin);
        if (!isStorageProxyPath(parsed.pathname)) return false;
        return parsed.host === reqUrl.host;
    } catch {
        return false;
    }
};

const downloadFromS3Key = async (s3: any, bucketName: string, key: string): Promise<Buffer> => {
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
        if (!res?.Body) throw new Error(`S3 object has no body: ${key}`);
        return streamToBuffer(res.Body);
    } catch (err) {
        throw mapRemoveBgError(err) || err;
    }
};

const hasMeaningfulTransparency = async (buffer: Buffer): Promise<boolean> => {
    try {
        const sharp = (await import("sharp")).default;
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        const total = Math.max(1, info.width * info.height);
        let transparentOrSemi = 0;
        for (let i = 3; i < data.length; i += 4) {
            if ((data[i] ?? 0) < 250) transparentOrSemi++;
        }
        const pct = (transparentOrSemi / total) * 100;
        return pct >= 1.5;
    } catch {
        // Não bloquear pipeline por falha de análise.
        return true;
    }
};

const hasLikelySubjectPreserved = async (buffer: Buffer): Promise<boolean> => {
    try {
        const sharp = (await import("sharp")).default;
        const { data, info } = await sharp(buffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const total = Math.max(1, info.width * info.height);
        let visible = 0;
        let opaque = 0;
        for (let i = 3; i < data.length; i += 4) {
            const alpha = data[i] ?? 0;
            if (alpha >= 16) visible++;
            if (alpha >= 200) opaque++;
        }
        const visiblePct = (visible / total) * 100;
        const opaquePct = (opaque / total) * 100;
        // Bloqueia recortes "fantasma" que apagam quase todo o produto.
        return visiblePct >= 7 && opaquePct >= 2;
    } catch {
        return true;
    }
};

const guessOpenAiSize = async (buffer: Buffer): Promise<'1024x1024' | '1024x1536' | '1536x1024'> => {
    try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(buffer).metadata();
        const w = Math.max(1, Number(meta.width || 1));
        const h = Math.max(1, Number(meta.height || 1));
        const ar = w / h;
        if (ar > 1.15) return '1536x1024';
        if (ar < 0.87) return '1024x1536';
        return '1024x1024';
    } catch {
        return '1024x1024';
    }
};

const convertBufferFormat = async (buffer: Buffer, outputFormat: 'webp' | 'png'): Promise<Buffer> => {
    if (outputFormat === 'png') return buffer;
    const sharp = (await import("sharp")).default;
    return sharp(buffer).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
};

const removeBgWithOpenAI = async (rawBuffer: Buffer, outputFormat: 'webp' | 'png'): Promise<Buffer> => {
    const sharp = (await import("sharp")).default;
    const pngInput = await sharp(rawBuffer).png().toBuffer();
    const size = await guessOpenAiSize(pngInput);

    const edited = await openAiEditImage({
        prompt: 'Remova apenas o fundo externo da imagem. Preserve totalmente o produto, rótulos, textos e detalhes finos. Não crie furos internos nem apague partes semitransparentes do produto. Retorne fundo transparente.',
        size,
        background: 'transparent',
        images: [{ data: pngInput, filename: 'source.png', mime: 'image/png' }]
    });

    return convertBufferFormat(edited.buffer, outputFormat);
};

const removeLightEdgeBackgroundFallback = async (rawBuffer: Buffer, outputFormat: 'webp' | 'png'): Promise<Buffer | null> => {
    try {
        const sharp = (await import("sharp")).default;
        const { data, info } = await sharp(rawBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const w = Math.max(1, Number(info.width || 1));
        const h = Math.max(1, Number(info.height || 1));
        const total = w * h;
        if (total <= 0) return null;

        const sampleRadius = Math.max(2, Math.floor(Math.min(w, h) * 0.03));
        const cornerSeeds = [
            { x: 0, y: 0 },
            { x: w - 1, y: 0 },
            { x: 0, y: h - 1 },
            { x: w - 1, y: h - 1 }
        ];

        let sr = 0, sg = 0, sb = 0, count = 0;
        for (const seed of cornerSeeds) {
            for (let dy = 0; dy < sampleRadius; dy++) {
                for (let dx = 0; dx < sampleRadius; dx++) {
                    const x = seed.x === 0 ? dx : Math.max(0, w - 1 - dx);
                    const y = seed.y === 0 ? dy : Math.max(0, h - 1 - dy);
                    const p = (y * w + x) * 4;
                    sr += data[p] ?? 0;
                    sg += data[p + 1] ?? 0;
                    sb += data[p + 2] ?? 0;
                    count++;
                }
            }
        }

        if (count <= 0) return null;
        const bgR = sr / count;
        const bgG = sg / count;
        const bgB = sb / count;
        const bgBrightness = (bgR + bgG + bgB) / 3;

        const colorThreshold = bgBrightness > 210 ? 62 : bgBrightness > 175 ? 52 : 42;
        const brightnessThreshold = Math.min(248, bgBrightness + 16);
        const maxSaturation = 36;

        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const canBeBackground = (idx: number): boolean => {
            const p = idx * 4;
            const r = data[p] ?? 0;
            const g = data[p + 1] ?? 0;
            const b = data[p + 2] ?? 0;
            const a = data[p + 3] ?? 0;
            if (a <= 12) return true;

            const dr = r - bgR;
            const dg = g - bgG;
            const db = b - bgB;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            const brightness = (r + g + b) / 3;
            const saturation = Math.max(r, g, b) - Math.min(r, g, b);

            const nearBackground = dist <= colorThreshold;
            const lightNeutral = brightness >= brightnessThreshold && saturation <= maxSaturation;
            return nearBackground || lightNeutral;
        };

        const push = (idx: number) => {
            if (idx < 0 || idx >= total) return;
            if (visited[idx]) return;
            if (!canBeBackground(idx)) return;
            visited[idx] = 1;
            queue[tail++] = idx;
        };

        for (let x = 0; x < w; x++) {
            push(x);
            push((h - 1) * w + x);
        }
        for (let y = 0; y < h; y++) {
            push(y * w);
            push(y * w + (w - 1));
        }

        while (head < tail) {
            const idx = queue[head++];
            const x = idx % w;
            const y = Math.floor(idx / w);
            if (x > 0) push(idx - 1);
            if (x < w - 1) push(idx + 1);
            if (y > 0) push(idx - w);
            if (y < h - 1) push(idx + w);
        }

        if (tail < Math.floor(total * 0.02)) {
            return null;
        }

        for (let i = 0; i < tail; i++) {
            const px = queue[i] * 4 + 3;
            data[px] = 0;
        }

        const png = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
        return convertBufferFormat(png, outputFormat);
    } catch (err) {
        console.warn("⚠️ [Remove BG] Fallback light-edge falhou:", (err as any)?.message || err);
        return null;
    }
};

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event);
    enforceRateLimit(event, `remove-image-bg:${user.id}`, 20, 60_000);

    try {
        const contentType = getHeader(event, "content-type") || "";
        const config = useRuntimeConfig();
        const s3 = getS3Client();
        const bucketName = config.wasabiBucket;

        let rawBuffer: Buffer | null = null;
        let sourceLabel = "unknown";
        let imageUrl: string | null = null;
        let sourceKey: string | null = null;
        let overwrite = false;

        if (contentType.includes("multipart/form-data")) {
            const form = await readMultipartFormData(event);
            const file = form?.find((p) => p.name === "file") || form?.[0];
            const overwriteField = form?.find((p) => p.name === "overwrite") as any;
            const sourceKeyField = form?.find((p) => p.name === "sourceKey") as any;
            overwrite = overwriteField?.data ? String(overwriteField.data).toLowerCase() === 'true' || String(overwriteField.data) === '1' : false;
            sourceKey = normalizeSourceKey(sourceKeyField?.data);

            if (!file?.data) {
                throw createError({ statusCode: 400, statusMessage: "file is required" });
            }
            const fileSize = Number(file.data?.length || 0);
            if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
                throw createError({ statusCode: 400, statusMessage: "Invalid file size (max 12MB)" });
            }
            if (file.type && !String(file.type).toLowerCase().startsWith('image/')) {
                throw createError({ statusCode: 400, statusMessage: "Invalid file type. Only images are allowed." });
            }
            if (sourceKey && !isAllowedStorageKey(sourceKey)) {
                throw createError({ statusCode: 400, statusMessage: "Invalid sourceKey" });
            }

            rawBuffer = file.data;
            sourceLabel = file.filename || "uploaded file";
        } else {
            const body = await readBody(event);
            const { imageUrl: bodyImageUrl, imageDataUrl, overwrite: bodyOverwrite, sourceKey: bodySourceKey } = body || {};
            overwrite = bodyOverwrite === true || bodyOverwrite === 1 || bodyOverwrite === '1';
            sourceKey = normalizeSourceKey(bodySourceKey);
            if (sourceKey && !isAllowedStorageKey(sourceKey)) {
                throw createError({ statusCode: 400, statusMessage: "Invalid sourceKey" });
            }

            if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
                if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
                    throw createError({ statusCode: 400, statusMessage: "imageDataUrl too large (max 8MB)" });
                }
                const match = /^data:([^;]+);base64,(.+)$/.exec(imageDataUrl);
                if (!match) {
                    throw createError({ statusCode: 400, statusMessage: "Invalid imageDataUrl" });
                }
                rawBuffer = Buffer.from(match[2] ?? "", "base64");
                sourceLabel = "data-url";
            } else if (typeof bodyImageUrl === "string" && bodyImageUrl) {
                imageUrl = bodyImageUrl.startsWith("/")
                    ? new URL(bodyImageUrl, getRequestURL(event).origin).toString()
                    : bodyImageUrl;

                if (!sourceKey) {
                    sourceKey = extractAnyKey(imageUrl, bucketName);
                }

                sourceLabel = sourceKey ? `s3:${sourceKey}` : imageUrl;
                if (sourceKey) {
                    rawBuffer = await downloadFromS3Key(s3, bucketName, sourceKey);
                } else if (isSameOriginStorageProxyUrl(imageUrl, event)) {
                    rawBuffer = await downloadImage(imageUrl, { maxBytes: MAX_UPLOAD_BYTES, timeoutMs: 15_000 });
                } else {
                    rawBuffer = await downloadImage(
                        assertSafeExternalHttpUrl(imageUrl, { maxLength: 2048 }),
                        { maxBytes: MAX_UPLOAD_BYTES, timeoutMs: 15_000 }
                    );
                }
            } else {
                throw createError({ statusCode: 400, statusMessage: "imageUrl or file is required" });
            }
        }

        console.log("🎨 [Remove BG] Iniciando remoção de fundo para:", sourceLabel);
        if (!rawBuffer) {
            throw createError({ statusCode: 400, statusMessage: "No source image data" });
        }

        const timestamp = Date.now();

        // Resolve destination key for overwrite or temp output
        let key: string | null = null;
        let overwritten = false;
        let outputFormat: 'webp' | 'png' = 'webp';

        if (overwrite) {
            const extractedKey = sourceKey || (imageUrl ? extractAnyKey(imageUrl, bucketName) : null);
            if (extractedKey) {
                key = extractedKey;
                overwritten = true;
                const lower = extractedKey.toLowerCase();
                outputFormat = lower.endsWith('.png') ? 'png' : 'webp';
            }
        }

        if (!key) {
            // Keep derived images in imagens/ folder
            key = `imagens/bg-removed-${timestamp}.${outputFormat === 'png' ? 'png' : 'webp'}`;
        }

        // Process (remove BG obrigatório para ação explícita do botão "Fundo")
        // Estratégia em cascata para evitar 500 e aumentar taxa de sucesso.
        let processedBuffer: Buffer | null = null;
        let lastLocalError: any = null;

        const isVercelRuntime = !!(process.env.VERCEL || process.env.VERCEL_URL);
        const tryOpenAiFallback = async () => {
            if (processedBuffer || !config.openaiApiKey) return;
            try {
                console.log("🤖 [Remove BG] Tentando fallback OpenAI...");
                const openAiBuffer = await removeBgWithOpenAI(rawBuffer, outputFormat);
                const hasAlphaCut = await hasMeaningfulTransparency(openAiBuffer);
                const hasSubject = await hasLikelySubjectPreserved(openAiBuffer);
                if (hasAlphaCut && hasSubject) {
                    processedBuffer = openAiBuffer;
                    console.log("✅ [Remove BG] Fallback OpenAI aplicado com transparência");
                } else {
                    console.warn(`⚠️ [Remove BG] OpenAI retornou saída inválida (alpha=${hasAlphaCut}, subject=${hasSubject})`);
                }
            } catch (openAiErr: any) {
                console.warn("⚠️ [Remove BG] Fallback OpenAI falhou:", openAiErr?.message || openAiErr);
            }
        };

        if (isVercelRuntime) {
            await tryOpenAiFallback();
        }

        const localAttempts: Array<{ model?: 'small' | 'medium' | 'large'; strict: boolean }> = isVercelRuntime
            ? [{ model: 'small', strict: true }]
            : [
                { model: 'large', strict: true },
                { model: 'medium', strict: true },
                { model: 'small', strict: true }
            ];

        for (const attempt of localAttempts) {
            try {
                processedBuffer = await processImageWithOptions(rawBuffer, {
                    outputFormat,
                    strict: attempt.strict,
                    forceBgRemoval: true,
                    bgRemoval: attempt.model ? { model: attempt.model } : undefined
                });
                if (!processedBuffer) continue;
                const hasAlphaCut = await hasMeaningfulTransparency(processedBuffer);
                const hasSubject = await hasLikelySubjectPreserved(processedBuffer);
                if (hasAlphaCut && hasSubject) {
                    console.log(`✅ [Remove BG] Sucesso local (model=${attempt.model || 'default'}, strict=${attempt.strict})`);
                    break;
                }
                console.warn(`⚠️ [Remove BG] Saída local inválida (alpha=${hasAlphaCut}, subject=${hasSubject}) (model=${attempt.model || 'default'}, strict=${attempt.strict})`);
                processedBuffer = null;
            } catch (err: any) {
                lastLocalError = err;
                console.warn(`⚠️ [Remove BG] Tentativa local falhou (model=${attempt.model || 'default'}, strict=${attempt.strict}):`, err?.message || err);
            }
        }

        await tryOpenAiFallback();

        if (!processedBuffer) {
            const lightEdge = await removeLightEdgeBackgroundFallback(rawBuffer, outputFormat);
            if (lightEdge) {
                const hasAlphaCut = await hasMeaningfulTransparency(lightEdge);
                const hasSubject = await hasLikelySubjectPreserved(lightEdge);
                if (hasAlphaCut && hasSubject) {
                    processedBuffer = lightEdge;
                    console.log("✅ [Remove BG] Fallback light-edge aplicado com transparência");
                } else {
                    console.warn(`⚠️ [Remove BG] Fallback light-edge inválido (alpha=${hasAlphaCut}, subject=${hasSubject})`);
                }
            }
        }

        if (!processedBuffer) {
            const fallbackHint = isVercelRuntime && !config.openaiApiKey
                ? " Configure NUXT_OPENAI_API_KEY (or OPENAI_API_KEY) on Vercel to enable fallback."
                : "";
            throw createError({
                statusCode: 422,
                statusMessage: "Background removal failed",
                message: `${String(lastLocalError?.message || "Background removal failed in all strategies")}${fallbackHint}`
            });
        }

        // Upload to Wasabi S3 (overwrite or new key)
        const contentTypeOut = outputFormat === 'png' ? 'image/png' : 'image/webp';

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: processedBuffer,
            ContentType: contentTypeOut,
            ACL: 'public-read'
        });

        try {
            await s3.send(putCommand);
        } catch (err) {
            throw mapRemoveBgError(err) || err;
        }

        // Generate public URL
        const endpoint = config.wasabiEndpoint || 's3.wasabisys.com';
        const canonicalUrl = `https://${endpoint}/${bucketName}/${key}`;
        const finalUrl = `${canonicalUrl}?v=${timestamp}`;

        console.log('✅ [Remove BG] Fundo removido com sucesso:', finalUrl);

        return {
            success: true,
            url: finalUrl,
            canonicalUrl,
            key,
            overwritten
        };

    } catch (err: any) {
        console.error("❌ [Remove BG] Erro ao remover fundo:", err);
        const mappedError = mapRemoveBgError(err);
        if (mappedError) throw mappedError;

        const detailedMessage = getErrorMessage(err);
        throw createError({ statusCode: 500, statusMessage: detailedMessage, message: detailedMessage });
    }
});
