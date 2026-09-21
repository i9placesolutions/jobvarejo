#!/usr/bin/env node
/** Read-only cache of owned flyer assets for local browser previews. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { paletteFromArtwork } from './lib/template-art-palette.mjs'

const argumentsMap = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...parts] = value.split('=')
  return [key, parts.join('=')]
}))
const source = argumentsMap['--source'] || '/tmp/jobvarejo-flyer-redesign-source.json'
const output = argumentsMap['--output'] || '/tmp/jobvarejo-flyer-redesign-assets'
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)))
const publicRoot = resolve(repo, 'public')
const bucket = process.env.WASABI_BUCKET
const endpoint = process.env.WASABI_ENDPOINT?.replace(/^https?:\/\//, '').replace(/\/$/, '')
if (!bucket || !endpoint) throw new Error('WASABI_BUCKET e WASABI_ENDPOINT são obrigatórios')
const s3 = new S3Client({
  endpoint: `https://${endpoint}`, region: process.env.WASABI_REGION, forcePathStyle: true,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY }
})
const endpointHost = new URL(`https://${endpoint}`).hostname
const ownedHosts = new Set([endpointHost, `${bucket}.${endpointHost}`, 'jobvarejo.com.br', 'www.jobvarejo.com.br', 'localhost', '127.0.0.1'])
const plans = JSON.parse(await readFile(source, 'utf8'))
await mkdir(output, { recursive: true })

const references = new Set()
const trimReferences = new Set()
const pages = []
const errors = []
const manifest = {}
const palettes = {}
const trims = {}
const safeRef = value => value.startsWith('data:') ? `data-uri:${createHash('sha256').update(value).digest('hex')}` : value
const imageLike = object => String(object?.type || '').toLowerCase() === 'image'
const collect = value => {
  if (!value || typeof value !== 'object') return
  const bitmapRef = value.src || value.__originalSrc
  if (imageLike(value) && bitmapRef && (value.businessProfileField === 'logo' || /selo|seal|logo/i.test(value.name || ''))) trimReferences.add(bitmapRef)
  for (const [key, item] of Object.entries(value)) {
    if ((key === 'src' || key === '__originalSrc') && typeof item === 'string' && item) references.add(item)
    else if (item && typeof item === 'object') collect(item)
  }
}
const visibleArea = object => Math.abs(Number(object.width || 0) * Number(object.height || 0) * Number(object.scaleX ?? 1) * Number(object.scaleY ?? 1))
for (const plan of plans) for (const entry of plan.entries) {
  if (!entry.canvas) continue
  collect(entry.canvas)
  const pageArea = Number(entry.page.width) * Number(entry.page.height)
  const candidates = (entry.canvas.objects || []).filter(object => {
    if (!imageLike(object) || object.visible === false || !(object.src || object.__originalSrc)) return false
    if (object.businessProfileField || object.quickDataField || /selo|seal|logo|footer|rodap[eé]|icon|badge|validity/i.test(object.name || '')) return false
    return /fundo|background|header-bg|decora[cç][aã]o/i.test(object.name || '') || visibleArea(object) >= pageArea * .65
  }).sort((a, b) => visibleArea(b) - visibleArea(a))
  const backdrop = imageLike(entry.canvas.backgroundImage) ? entry.canvas.backgroundImage : candidates[0]
  pages.push({ id: entry.page.id, name: plan.project.name, format: entry.page.templateFormatId,
    ref: backdrop?.src || backdrop?.__originalSrc || '', objectName: backdrop?.name || '' })
}

async function resolveReference(ref) {
  if (ref.startsWith('data:')) {
    const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(ref)
    if (!match || !match[1].startsWith('image/')) throw new Error('Data URI não é uma imagem válida')
    return { buffer: match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3])), mime: match[1], origin: 'embedded' }
  }
  const url = new URL(ref, 'http://local.invalid')
  const absolute = /^https?:\/\//i.test(ref)
  if (absolute && !ownedHosts.has(url.hostname)) throw new Error(`Host fora do storage autorizado: ${url.hostname}`)
  let key = null
  if (/^\/api\/storage\//.test(url.pathname)) {
    key = url.searchParams.get('key')
    const requestedBucket = url.searchParams.get('bucket')
    if (requestedBucket && requestedBucket !== bucket) throw new Error('Bucket diferente do bucket configurado')
    if (!key) throw new Error('Referência de storage sem key')
  } else if (absolute && (url.hostname === endpointHost || url.hostname === `${bucket}.${endpointHost}`)) {
    key = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (key.startsWith(`${bucket}/`)) key = key.slice(bucket.length + 1)
  } else {
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const candidate = resolve(publicRoot, pathname)
    if (relative(publicRoot, candidate).startsWith('..')) throw new Error('Caminho fora de public')
    try {
      if ((await stat(candidate)).isFile()) return { buffer: await readFile(candidate), origin: 'public', mime: '' }
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (!absolute && !ref.startsWith('/')) key = pathname
    else throw new Error('Asset não encontrado em public nem identificado como storage')
  }
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return { buffer: Buffer.from(await object.Body.transformToByteArray()), mime: object.ContentType || '', origin: 'storage', key }
}

const buffers = new Map()
const extensionFor = (format, mime) => ({ jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif', gif: 'gif', svg: 'svg', tiff: 'tiff' }[format]
  || ({ 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime]) || 'img')
const mimeFor = (format, mime) => ({ jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml', tiff: 'image/tiff' }[format] || mime || 'application/octet-stream')
let cursor = 0
const refs = [...references]
async function downloadWorker() {
  for (;;) {
    const index = cursor++
    if (index >= refs.length) return
    const ref = refs[index]
    try {
      const result = await resolveReference(ref)
      const metadata = await sharp(result.buffer).metadata()
      const hash = createHash('sha256').update(result.buffer).digest('hex')
      const file = `${hash}.${extensionFor(metadata.format, result.mime)}`
      await writeFile(resolve(output, file), result.buffer)
      buffers.set(ref, result.buffer)
      manifest[ref] = { file, mime: mimeFor(metadata.format, result.mime), width: metadata.width,
        height: metadata.height, hasAlpha: Boolean(metadata.hasAlpha), bytes: result.buffer.length, sha256: hash, origin: result.origin }
    } catch (error) {
      errors.push({ stage: 'asset', ref: safeRef(ref), message: error.message })
    }
  }
}
try { await Promise.all(Array.from({ length: 8 }, downloadWorker)) } finally { s3.destroy() }

const paletteCache = new Map()
for (const page of pages) {
  try {
    if (!page.ref) throw new Error('Fundo bitmap não identificado: paleta requer revisão da composição')
    const buffer = buffers.get(page.ref)
    if (!buffer) throw new Error('Asset do fundo não carregado')
    if (!paletteCache.has(page.ref)) paletteCache.set(page.ref, await paletteFromArtwork(buffer))
    palettes[page.id] = { ...paletteCache.get(page.ref), sourceRef: page.ref, objectName: page.objectName }
  } catch (error) { errors.push({ stage: 'palette', pageId: page.id, name: page.name, format: page.format, message: error.message }) }
}
for (const ref of trimReferences) {
  const buffer = buffers.get(ref)
  if (!buffer) continue
  try {
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let x = info.width, y = info.height, right = 0, bottom = 0
    for (let row = 0; row < info.height; row++) for (let column = 0; column < info.width; column++) {
      if (data[(row * info.width + column) * info.channels + info.channels - 1] > 0) {
        x = Math.min(x, column); y = Math.min(y, row)
        right = Math.max(right, column + 1); bottom = Math.max(bottom, row + 1)
      }
    }
    if (right <= x || bottom <= y) throw new Error('Imagem completamente transparente')
    trims[ref] = { x, y, width: right - x, height: bottom - y, sourceWidth: info.width, sourceHeight: info.height,
      trimmed: x !== 0 || y !== 0 || right !== info.width || bottom !== info.height }
  } catch (error) { errors.push({ stage: 'trim', ref: safeRef(ref), message: error.message }) }
}
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
await writeFile(resolve(output, 'palettes.json'), JSON.stringify(palettes, null, 2))
await writeFile(resolve(output, 'trim.json'), JSON.stringify(trims, null, 2))
const report = { source, output, refs: refs.length, cached: Object.keys(manifest).length,
  uniqueFiles: new Set(Object.values(manifest).map(item => item.file)).size,
  pages: pages.length, palettes: Object.keys(palettes).length, trimCandidates: trimReferences.size,
  trims: Object.keys(trims).length, errors }
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (errors.length) process.exitCode = 1
