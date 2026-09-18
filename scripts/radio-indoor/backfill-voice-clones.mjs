#!/usr/bin/env node
/**
 * Gera clips .clone.mp3 para vozes já cadastradas (MusicGPT TTS).
 *
 * Uso:
 *   node scripts/radio-indoor/backfill-voice-clones.mjs
 *   node scripts/radio-indoor/backfill-voice-clones.mjs --force
 *   node scripts/radio-indoor/backfill-voice-clones.mjs --voice-id UUID
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

const loadEnv = () => {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    if (!line.includes('=') || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnv()

const force = process.argv.includes('--force')
const voiceIdArg = process.argv.find((a) => a.startsWith('--voice-id='))?.split('=')[1]
  || (process.argv.includes('--voice-id') ? process.argv[process.argv.indexOf('--voice-id') + 1] : null)

const buildClip = (sourceBuf) => {
  const dir = fs.mkdtempSync(path.join('/tmp', 'mgpt-backfill-'))
  const input = path.join(dir, 'source.bin')
  const output = path.join(dir, 'clip.mp3')
  fs.writeFileSync(input, sourceBuf)
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', '1', '-t', '18', '-i', input,
    '-vn',
    '-af', 'pan=mono|c0=0.5*c0+0.5*c1,highpass=f=120,lowpass=f=6500,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar', '44100', '-b:a', '192k', '-f', 'mp3', output
  ], { encoding: 'utf8' })
  if (r.status !== 0 || !fs.existsSync(output)) {
    // fallback sem afftdn
    const r2 = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', '1', '-t', '18', '-i', input,
      '-vn',
      '-af', 'pan=mono|c0=0.5*c0+0.5*c1,highpass=f=120,lowpass=f=6500,loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ar', '44100', '-b:a', '192k', '-f', 'mp3', output
    ], { encoding: 'utf8' })
    if (r2.status !== 0 || !fs.existsSync(output)) {
      fs.rmSync(dir, { recursive: true, force: true })
      throw new Error(r2.stderr?.slice(0, 300) || r.stderr?.slice(0, 300) || 'ffmpeg failed')
    }
  }
  const buf = fs.readFileSync(output)
  fs.rmSync(dir, { recursive: true, force: true })
  if (buf.length < 12000) throw new Error('clip too small')
  return buf
}

const main = async () => {
  const url = process.env.POSTGRES_DATABASE_URL
  if (!url) throw new Error('POSTGRES_DATABASE_URL ausente')
  let endpoint = process.env.WASABI_ENDPOINT || ''
  if (endpoint && !/^https?:/i.test(endpoint)) endpoint = `https://${endpoint}`
  const s3 = new S3Client({
    endpoint,
    region: process.env.WASABI_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.WASABI_ACCESS_KEY,
      secretAccessKey: process.env.WASABI_SECRET_KEY
    },
    forcePathStyle: true
  })
  const bucket = process.env.WASABI_BUCKET
  const client = new pg.Client({ connectionString: url, ssl: false })
  await client.connect()

  const params = []
  let sql = `select id, user_id, name, sample_storage_key, metadata
               from public.radio_voice_profiles
              where status = 'active' and consent_status = 'confirmed'`
  if (voiceIdArg) {
    params.push(voiceIdArg)
    sql += ` and id = $1`
  }
  sql += ` order by created_at desc`
  const { rows } = await client.query(sql, params)
  console.log(`Vozes: ${rows.length} (force=${force})`)

  for (const row of rows) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const cloneKey = `radio-indoor/voices/${row.user_id}/${row.id}.clone.mp3`
    if (!force && meta.cloneSampleKey) {
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: meta.cloneSampleKey }))
        console.log(`SKIP ${row.name} (${String(row.id).slice(0, 8)}) já tem clone`)
        continue
      } catch { /* regenera */ }
    }

    console.log(`BUILD ${row.name}...`)
    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: row.sample_storage_key }))
    const chunks = []
    for await (const c of obj.Body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
    const source = Buffer.concat(chunks)
    const clip = buildClip(source)
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: cloneKey,
      Body: clip,
      ContentType: 'audio/mpeg',
      Metadata: { source: 'jobvarejo-radio-voice-clone-backfill', voiceId: String(row.id) }
    }))
    await client.query(
      `update public.radio_voice_profiles
          set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb, updated_at = now()
        where id = $2`,
      [JSON.stringify({
        cloneSampleKey: cloneKey,
        cloneSampleBytes: clip.length,
        cloneSampleDurationSec: 18,
        cloneSampleStartSec: 1,
        clonePreparedAt: new Date().toISOString()
      }), row.id]
    )
    console.log(`OK ${row.name} → ${cloneKey} (${clip.length} bytes)`)
  }

  await client.end()
  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
