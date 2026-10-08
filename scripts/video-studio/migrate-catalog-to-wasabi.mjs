import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { resolve, relative, dirname, extname, join } from 'node:path'
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

// node --env-file=.env scripts/video-studio/migrate-catalog-to-wasabi.mjs --upload --archive
// Sem flags: inventaria os binários, sem enviar nem mover arquivos.
const root = resolve(import.meta.dirname, '../..')
const source = join(root, 'public/video-studio')
const archive = join(root, 'output/video-studio-catalog-source')
const manifestFile = join(root, 'shared/video-studio/catalog-assets.json')
const types = { '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }
const upload = process.argv.includes('--upload')
const shouldArchive = process.argv.includes('--archive')
if (shouldArchive && !upload) throw new Error('--archive exige --upload com verificação no Wasabi.')
let previous = { version: 1, assets: {} }
try { previous = JSON.parse(await readFile(manifestFile, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const assets = { ...previous.assets }
const files = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (entry.isFile() && types[extname(file).toLowerCase()]) files.push(file)
  }
}
await walk(source)
for (const file of files) {
  const path = relative(source, file).split('\\').join('/')
  const bytes = await readFile(file)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assets[path] = { key: `video-studio/catalog/${sha256}/${path}`, sha256, bytes: bytes.length, contentType: types[extname(file).toLowerCase()] }
}
await mkdir(dirname(manifestFile), { recursive: true })
await writeFile(manifestFile, JSON.stringify({ version: 1, assets: Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))) }, null, 2) + '\n')
console.log(JSON.stringify({ files: files.length, catalogEntries: Object.keys(assets).length, bytes: files.reduce((sum, file) => sum + assets[relative(source, file).split('\\').join('/')].bytes, 0), upload }))
if (!upload) process.exit(0)
const env = name => process.env[name] || process.env[`NUXT_${name}`]
const endpoint = env('WASABI_ENDPOINT')
const bucket = env('WASABI_BUCKET')
if (!endpoint || !bucket || !env('WASABI_ACCESS_KEY') || !env('WASABI_SECRET_KEY')) throw new Error('Configuração Wasabi incompleta.')
const s3 = new S3Client({ endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`, region: env('WASABI_REGION') || 'us-east-1', forcePathStyle: true, maxAttempts: 3, credentials: { accessKeyId: env('WASABI_ACCESS_KEY'), secretAccessKey: env('WASABI_SECRET_KEY') } })
let cursor = 0, verified = 0, uploaded = 0
const failures = []
async function migrate(file) {
  const path = relative(source, file).split('\\').join('/')
  const asset = assets[path]
  const command = { Bucket: bucket, Key: asset.key }
  let remote
  try { remote = await s3.send(new HeadObjectCommand(command)) } catch (error) { if (error.$metadata?.httpStatusCode !== 404 && error.name !== 'NotFound') throw error }
  if (!remote || Number(remote.ContentLength) !== asset.bytes || remote.Metadata?.sha256 !== asset.sha256) {
    const bytes = await readFile(file)
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Arquivo mudou durante a migração.')
    await s3.send(new PutObjectCommand({ ...command, Body: bytes, ContentType: asset.contentType, ContentMD5: createHash('md5').update(bytes).digest('base64'), CacheControl: 'public, max-age=31536000, immutable', Metadata: { sha256: asset.sha256 } }))
    uploaded++
    remote = await s3.send(new HeadObjectCommand(command))
  }
  if (Number(remote.ContentLength) !== asset.bytes || remote.Metadata?.sha256 !== asset.sha256) throw new Error('Verificação Wasabi falhou.')
  verified++
  if (shouldArchive) {
    const target = join(archive, path)
    await mkdir(dirname(target), { recursive: true })
    await rename(file, target)
  }
  if (verified % 50 === 0 || verified === files.length) console.log(JSON.stringify({ verified, uploaded, total: files.length }))
}
try {
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++]
      try { await migrate(file) } catch (error) { failures.push({ path: relative(source, file), reason: error.name || 'Error' }) }
    }
  }))
} finally { s3.destroy() }
console.log(JSON.stringify({ verified, uploaded, total: files.length, failures }))
if (failures.length) process.exitCode = 1
