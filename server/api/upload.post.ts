import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { requireAuthenticatedUser } from "../utils/auth";
import { enforceRateLimit } from "../utils/rate-limit";

/**
 * API Route para upload de arquivos para Wasabi Storage
 *
 * Usa a pasta 'imagens/' para uploads gerais
 */

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  enforceRateLimit(event, `upload:${user.id}`, 40, 60_000);

  // Check for configuration - Wasabi
  const config = useRuntimeConfig();
  const endpoint = config.wasabiEndpoint;
  const region = config.wasabiRegion || "us-east-1";
  const accessKeyId = config.wasabiAccessKey;
  const secretAccessKey = config.wasabiSecretKey;
  const bucketName = config.wasabiBucket;

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

  const s3Client = new S3Client({
    region: region,
    endpoint: `https://${endpoint}`,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true // Necessário para Wasabi
  });

  const files = await readMultipartFormData(event);
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const file = files[0];
  if (!file?.filename || !file.data) {
     throw createError({ statusCode: 400, statusMessage: "Filename missing" });
  }

  const originalFilename = String(file.filename || "upload").trim() || "upload";
  const originalMime = String(file.type || "application/octet-stream");

  // Otimizar imagens para reduzir custo de storage e acelerar load no editor.
  // Mantemos formatos não-compatíveis com sharp (ex: SVG/GIF) como estão.
  let bodyBuffer: Buffer = Buffer.from(file.data as any);
  let contentType: string = originalMime;
  let ext: string = (originalFilename.split(".").pop() || "").toLowerCase();

  const isImage = originalMime.startsWith("image/");
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
      await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
      return {
        url: `/api/storage/p?key=${encodeURIComponent(key)}`,
        key,
        success: true,
        dedup: true,
        contentType
      };
    } catch {
      // Not found -> proceed to upload
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: bodyBuffer,
      ContentType: contentType,
      ACL: 'public-read'
    });

    const abortSignal = getAbortSignal(90_000)
    if (abortSignal) await s3Client.send(command, { abortSignal })
    else await s3Client.send(command)

    console.log('✅ File uploaded to Wasabi:', key);

    return {
      url: `/api/storage/p?key=${encodeURIComponent(key)}`,
      key: key,
      success: true,
      dedup: false,
      contentType,
      originalBytes: Number((file.data as any)?.length || 0),
      storedBytes: bodyBuffer.length
    };
  } catch (error) {
    console.error("Upload Error to Wasabi:", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to upload to Wasabi" });
  }
});
