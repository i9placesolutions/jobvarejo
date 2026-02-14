import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * API Route para upload de arquivos para Wasabi Storage
 *
 * Usa a pasta 'imagens/' para uploads gerais
 */

export default defineEventHandler(async (event) => {
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

  // Usa pasta 'imagens/' conforme solicitado
  const key = `imagens/${Date.now()}-${file.filename}`;

  const getAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
    const timeoutFactory = (AbortSignal as any)?.timeout
    if (typeof timeoutFactory !== 'function') return undefined
    return timeoutFactory(timeoutMs)
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.data,
      ContentType: file.type,
      ACL: 'public-read'
    });

    const abortSignal = getAbortSignal(90_000)
    if (abortSignal) await s3Client.send(command, { abortSignal })
    else await s3Client.send(command)

    console.log('✅ File uploaded to Wasabi:', key);

    return {
      url: `/api/storage/p?key=${encodeURIComponent(key)}`,
      key: key,
      success: true
    };
  } catch (error) {
    console.error("Upload Error to Wasabi:", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to upload to Wasabi" });
  }
});
