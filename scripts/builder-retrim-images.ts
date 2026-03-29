/**
 * Script para re-processar imagens de produtos do builder.
 * Aplica auto-trim (recorta bordas transparentes) para que o produto
 * preencha melhor a imagem.
 *
 * Uso: npx tsx scripts/builder-retrim-images.ts
 *
 * Requer variáveis de ambiente:
 *   WASABI_ENDPOINT, WASABI_ACCESS_KEY, WASABI_SECRET_KEY, WASABI_BUCKET,
 *   POSTGRES_DATABASE_URL
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import pg from 'pg'

// ── Config ──────────────────────────────────────────────────────────────────
const {
  WASABI_ENDPOINT = 's3.wasabisys.com',
  WASABI_ACCESS_KEY = '',
  WASABI_SECRET_KEY = '',
  WASABI_REGION = 'us-east-1',
  WASABI_BUCKET = 'jobvarejo',
  POSTGRES_DATABASE_URL = '',
} = process.env

if (!WASABI_ACCESS_KEY || !WASABI_SECRET_KEY || !POSTGRES_DATABASE_URL) {
  console.error('Variáveis de ambiente necessárias: WASABI_ACCESS_KEY, WASABI_SECRET_KEY, POSTGRES_DATABASE_URL')
  process.exit(1)
}

const s3 = new S3Client({
  region: WASABI_REGION,
  endpoint: `https://${WASABI_ENDPOINT}`,
  credentials: { accessKeyId: WASABI_ACCESS_KEY, secretAccessKey: WASABI_SECRET_KEY },
  forcePathStyle: true,
})

const pool = new pg.Pool({ connectionString: POSTGRES_DATABASE_URL })

// ── Helpers ─────────────────────────────────────────────────────────────────
async function streamToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Buffer[] = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function trimImage(buffer: Buffer): Promise<{ buffer: Buffer; trimmed: boolean; width: number; height: number }> {
  const meta = await sharp(buffer).metadata()
  if (!meta.hasAlpha) {
    return { buffer, trimmed: false, width: meta.width || 0, height: meta.height || 0 }
  }

  try {
    const result = await sharp(buffer)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
      .toBuffer({ resolveWithObject: true })

    if (result.info.width >= 20 && result.info.height >= 20) {
      // Só considera trimmed se reduziu pelo menos 5% em alguma dimensão
      const widthReduced = meta.width ? (meta.width - result.info.width) / meta.width : 0
      const heightReduced = meta.height ? (meta.height - result.info.height) / meta.height : 0
      const significantTrim = widthReduced > 0.05 || heightReduced > 0.05

      if (significantTrim) {
        // Re-exportar no formato original
        const ext = detectFormat(buffer)
        let output: Buffer
        if (ext === 'webp') {
          output = await sharp(result.data).webp({ quality: 85, alphaQuality: 100 }).toBuffer()
        } else {
          output = await sharp(result.data).png().toBuffer()
        }
        return { buffer: output, trimmed: true, width: result.info.width, height: result.info.height }
      }
    }
  } catch {
    // trim falhou, retornar original
  }

  return { buffer, trimmed: false, width: meta.width || 0, height: meta.height || 0 }
}

function detectFormat(buffer: Buffer): 'webp' | 'png' {
  // WebP magic bytes: RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'webp'
  return 'png'
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Buscando imagens de produtos no builder...')

  // Buscar todas as imagens únicas de flyer_products + products
  const { rows } = await pool.query<{ custom_image: string }>(`
    SELECT DISTINCT custom_image FROM builder_flyer_products
    WHERE custom_image IS NOT NULL AND custom_image != ''
    UNION
    SELECT DISTINCT image FROM builder_products
    WHERE image IS NOT NULL AND image != ''
  `)

  console.log(`📦 ${rows.length} imagens encontradas`)

  let processed = 0
  let trimmed = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const key = row.custom_image
    if (!key || key.startsWith('http')) {
      skipped++
      continue
    }

    try {
      // Baixar do S3
      const res = await s3.send(new GetObjectCommand({ Bucket: WASABI_BUCKET, Key: key }))
      const buffer = await streamToBuffer(res.Body)

      if (!buffer.length) {
        skipped++
        continue
      }

      // Aplicar trim
      const result = await trimImage(buffer)
      processed++

      if (result.trimmed) {
        // Re-subir com mesmo key (sobrescreve)
        const contentType = key.endsWith('.webp') ? 'image/webp' : 'image/png'
        await s3.send(new PutObjectCommand({
          Bucket: WASABI_BUCKET,
          Key: key,
          Body: result.buffer,
          ContentType: contentType,
        }))
        trimmed++
        console.log(`  ✂️ ${key} → ${result.width}x${result.height}`)
      } else {
        console.log(`  ⏭️ ${key} (sem mudança)`)
      }
    } catch (err: any) {
      errors++
      console.error(`  ❌ ${key}: ${err?.message || err}`)
    }
  }

  console.log('\n📊 Resultado:')
  console.log(`   Processadas: ${processed}`)
  console.log(`   Trimmed:     ${trimmed}`)
  console.log(`   Sem mudança: ${processed - trimmed}`)
  console.log(`   Puladas:     ${skipped}`)
  console.log(`   Erros:       ${errors}`)

  await pool.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
