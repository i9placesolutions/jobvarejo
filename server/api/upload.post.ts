import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";
import { getPublicUrl, getS3Client, resetS3Client } from "../utils/s3";
import { resolveStorageReadUrl } from "../utils/project-storage-refs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
  "image/heic",
  "image/heif"
]);

const inferImageMimeFromExt = (ext: string): string => {
  const e = String(ext || '').toLowerCase()
  if (e === 'png') return 'image/png'
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
  if (e === 'webp') return 'image/webp'
  if (e === 'gif') return 'image/gif'
  if (e === 'svg') return 'image/svg+xml'
  if (e === 'avif') return 'image/avif'
  if (e === 'heic') return 'image/heic'
  if (e === 'heif') return 'image/heif'
  return 'application/octet-stream'
}

const isRetryableS3Error = (err: any): boolean => {
  const statusCode = Number(err?.$metadata?.httpStatusCode || err?.statusCode || 0)
  const name = String(err?.name || err?.constructor?.name || '')
  const message = String(err?.message || '')
  return (
    !statusCode ||
    statusCode >= 500 ||
    name === 'AbortError' ||
    /timeout|socket|econn|reset|network/i.test(message)
  )
}

/**
 * API Route para upload de arquivos para Wasabi Storage
 *
 * Usa a pasta 'imagens/' para uploads gerais
 */

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  await enforceRateLimit(event, `upload:${user.id}`, 40, 60_000);

  // Check for configuration - Wasabi
  const config = useRuntimeConfig();
  const endpoint = config.wasabiEndpoint || process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT;
  const accessKeyId = config.wasabiAccessKey || process.env.WASABI_ACCESS_KEY || process.env.NUXT_WASABI_ACCESS_KEY;
  const secretAccessKey = config.wasabiSecretKey || process.env.WASABI_SECRET_KEY || process.env.NUXT_WASABI_SECRET_KEY;
  const bucketName = config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET;

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    const missing: string[] = []
    if (!endpoint) missing.push('WASABI_ENDPOINT')
    if (!bucketName) missing.push('WASABI_BUCKET')
    if (!accessKeyId) missing.push('WASABI_ACCESS_KEY')
    if (!secretAccessKey) missing.push('WASABI_SECRET_KEY')

    throw createError({
        statusCode: 500,
        statusMessage: `Wasabi Storage configuration missing (${missing.join(', ')})`
    });
  }

  const files = await readMultipartFormData(event);
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const file = files[0];
  if (!file?.filename || !file.data) {
     throw createError({ statusCode: 400, statusMessage: "Filename missing" });
  }

  const originalFilename = String(file.filename || "upload").trim() || "upload";
  const originalMime = String(file.type || "").trim().toLowerCase();
  const inputBytes = Number((file.data as any)?.length || 0);
  if (!Number.isFinite(inputBytes) || inputBytes <= 0 || inputBytes > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "Invalid file size (max 15MB)" });
  }

  // Otimizar imagens para reduzir custo de storage e acelerar load no editor.
  // Mantemos formatos não-compatíveis com sharp (ex: SVG/GIF) como estão.
  let bodyBuffer: Buffer = Buffer.from(file.data as any);
  let ext: string = (originalFilename.split(".").pop() || "").toLowerCase();
  let contentType: string = originalMime || inferImageMimeFromExt(ext);

  const inferredImageByExt = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "heic", "heif"]).has(ext);
  const isImage = originalMime.startsWith("image/") || inferredImageByExt;
  if (!isImage || (originalMime && !ALLOWED_IMAGE_MIME_TYPES.has(originalMime))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid file type. Only image uploads are allowed." });
  }
  const isSvg = originalMime === "image/svg+xml" || ext === "svg";
  const isGif = originalMime === "image/gif" || ext === "gif";

  if (isImage && !isSvg && !isGif) {
    try {
      const sharp = (await import("sharp")).default;
      bodyBuffer = await sharp(bodyBuffer)
        .rotate()
        .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88, effort: 4 })
        .toBuffer();
      contentType = "image/webp";
      ext = "webp";
    } catch (err: any) {
      console.warn("⚠️ [upload] Otimização falhou, enviando original:", err?.message || err);
      // fallback: enviar original
    }
  }

  const safeBase = originalFilename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "upload";

  // Dedup por conteúdo: reupload do mesmo arquivo não deve inflar bucket.
  const hash = createHash("sha256").update(bodyBuffer).digest("hex").slice(0, 16);
  const key = `imagens/${hash}-${safeBase}.${ext || "bin"}`;

  const getAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
    const timeoutFactory = (AbortSignal as any)?.timeout
    if (typeof timeoutFactory !== 'function') return undefined
    return timeoutFactory(timeoutMs)
  }

  try {
    // Se já existe, evita duplicar.
    try {
      await getS3Client().send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      const canonicalUrl = getPublicUrl(key)
      const readUrl = await resolveStorageReadUrl(key, user.id)
      return {
        url: readUrl || canonicalUrl,
        publicUrl: readUrl || canonicalUrl,
        canonicalUrl,
        key,
        success: true,
        dedup: true,
        contentType
      };
    } catch (headErr: any) {
      const statusCode = Number(headErr?.$metadata?.httpStatusCode || headErr?.statusCode || 0)
      if (statusCode && statusCode !== 404) {
        console.warn('[upload] HeadObject falhou; seguindo para upload:', {
          statusCode,
          name: headErr?.name,
          message: headErr?.message
        })
      }
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: bodyBuffer,
      ContentType: contentType,
      ACL: 'public-read'
    });

    const MAX_ATTEMPTS = 2
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const abortSignal = getAbortSignal(90_000)
        if (abortSignal) await getS3Client().send(command, { abortSignal })
        else await getS3Client().send(command)
        break
      } catch (putErr: any) {
        if (isRetryableS3Error(putErr)) resetS3Client()
        if (attempt < MAX_ATTEMPTS && isRetryableS3Error(putErr)) {
          console.warn(`[upload] PutObject falhou na tentativa ${attempt}; tentando novamente com novo cliente S3.`, {
            name: putErr?.name,
            message: putErr?.message
          })
          continue
        }
        throw putErr
      }
    }

    console.log('✅ File uploaded to Wasabi:', key);
    const canonicalUrl = getPublicUrl(key)
    const readUrl = await resolveStorageReadUrl(key, user.id)

    return {
      url: readUrl || canonicalUrl,
      publicUrl: readUrl || canonicalUrl,
      canonicalUrl,
      key: key,
      success: true,
      dedup: false,
      contentType,
      originalBytes: inputBytes,
      storedBytes: bodyBuffer.length
    };
  } catch (error) {
    console.error("Upload Error to Wasabi:", error);
    throw createError({ statusCode: 502, statusMessage: "Failed to upload to Wasabi" });
  }
});
