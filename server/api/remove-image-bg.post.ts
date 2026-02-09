import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { processImageWithOptions, downloadImage } from "~/server/utils/image-processor";
import { getS3Client } from "~/server/utils/s3";
import { openAiEditImage } from "~/server/utils/openai-images";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";

const KEY_PREFIXES = ["projects/", "imagens/", "uploads/", "logo/"];

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

const extractProxyKeyFromUrl = (rawUrl: string): string | null => {
    try {
        const decoded = decodeURIComponent(rawUrl);
        const urlObj = decoded.startsWith("http://") || decoded.startsWith("https://")
            ? new URL(decoded)
            : new URL(decoded, "http://local");
        if (!urlObj.pathname.endsWith("/api/storage/proxy")) return null;
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

const downloadFromS3Key = async (s3: any, bucketName: string, key: string): Promise<Buffer> => {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    if (!res?.Body) throw new Error(`S3 object has no body: ${key}`);
    return streamToBuffer(res.Body);
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
        prompt: 'Remova completamente o fundo da imagem, mantendo apenas o produto principal intacto, com contornos limpos e fundo transparente.',
        size,
        background: 'transparent',
        images: [{ data: pngInput, filename: 'source.png', mime: 'image/png' }]
    });

    return convertBufferFormat(edited.buffer, outputFormat);
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
            sourceKey = sourceKeyField?.data ? String(sourceKeyField.data).trim() : null;

            if (!file?.data) {
                throw createError({ statusCode: 400, statusMessage: "file is required" });
            }

            rawBuffer = file.data;
            sourceLabel = file.filename || "uploaded file";
        } else {
            const body = await readBody(event);
            const { imageUrl: bodyImageUrl, imageDataUrl, overwrite: bodyOverwrite, sourceKey: bodySourceKey } = body || {};
            overwrite = bodyOverwrite === true || bodyOverwrite === 1 || bodyOverwrite === '1';
            sourceKey = typeof bodySourceKey === "string" && bodySourceKey.trim() ? decodeURIComponent(bodySourceKey.trim()) : null;

            if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
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
                rawBuffer = sourceKey
                    ? await downloadFromS3Key(s3, bucketName, sourceKey)
                    : await downloadImage(imageUrl);
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

        const localAttempts: Array<{ model?: 'small' | 'medium' | 'large'; strict: boolean }> = [
            { model: 'large', strict: true },
            { model: 'medium', strict: true },
            { model: 'small', strict: true },
            { model: 'large', strict: false },
            { model: 'medium', strict: false }
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
                if (hasAlphaCut) {
                    console.log(`✅ [Remove BG] Sucesso local (model=${attempt.model || 'default'}, strict=${attempt.strict})`);
                    break;
                }
                console.warn(`⚠️ [Remove BG] Saída local sem transparência útil (model=${attempt.model || 'default'}, strict=${attempt.strict})`);
                processedBuffer = null;
            } catch (err: any) {
                lastLocalError = err;
                console.warn(`⚠️ [Remove BG] Tentativa local falhou (model=${attempt.model || 'default'}, strict=${attempt.strict}):`, err?.message || err);
            }
        }

        if (!processedBuffer && config.openaiApiKey) {
            try {
                console.log("🤖 [Remove BG] Tentando fallback OpenAI...");
                const openAiBuffer = await removeBgWithOpenAI(rawBuffer, outputFormat);
                const hasAlphaCut = await hasMeaningfulTransparency(openAiBuffer);
                if (hasAlphaCut) {
                    processedBuffer = openAiBuffer;
                    console.log("✅ [Remove BG] Fallback OpenAI aplicado com transparência");
                } else {
                    console.warn("⚠️ [Remove BG] OpenAI retornou imagem sem transparência útil");
                }
            } catch (openAiErr: any) {
                console.warn("⚠️ [Remove BG] Fallback OpenAI falhou:", openAiErr?.message || openAiErr);
            }
        }

        if (!processedBuffer) {
            throw new Error(lastLocalError?.message || "Background removal failed in all strategies");
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

        await s3.send(putCommand);

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
        throw createError({ statusCode: 500, statusMessage: "Failed to remove background", message: err.message });
    }
});
