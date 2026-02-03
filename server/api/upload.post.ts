import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
  // Check for configuration
  const config = useRuntimeConfig();
  const endpoint = config.contaboEndpoint;
  const region = config.contaboRegion || "default"; // specific region if needed
  const accessKeyId = config.contaboAccessKey;
  const secretAccessKey = config.contaboSecretKey;
  const bucketName = config.contaboBucket;

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    const missing: string[] = []
    if (!endpoint) missing.push('CONTABO_ENDPOINT')
    if (!bucketName) missing.push('CONTABO_BUCKET')
    if (!accessKeyId) missing.push('CONTABO_ACCESS_KEY')
    if (!secretAccessKey) missing.push('CONTABO_SECRET_KEY')

    throw createError({
        statusCode: 500,
        statusMessage: `Contabo Storage configuration missing (${missing.join(', ')})`
    });
  }

  const s3Client = new S3Client({
    region: region,
    endpoint: `https://${endpoint}`,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true // Usually needed for non-AWS S3
  });

  const files = await readMultipartFormData(event);
  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const file = files[0];
  if (!file.filename) {
     throw createError({ statusCode: 400, statusMessage: "Filename missing" });
  }

  const key = `uploads/${Date.now()}-${file.filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.data,
      ContentType: file.type,
      ACL: 'public-read' // Assuming we want it public
    });

    await s3Client.send(command);

    // Construct public URL
    // Contabo URL structure: https://<endpoint>/<bucket>/<key>
    const publicUrl = `https://${endpoint}/${bucketName}/${key}`;

    return {
      url: publicUrl,
      success: true
    };
  } catch (error) {
    console.error("Upload Error:", error);
    throw createError({ statusCode: 500, statusMessage: "Failed to upload to Contabo" });
  }
});
