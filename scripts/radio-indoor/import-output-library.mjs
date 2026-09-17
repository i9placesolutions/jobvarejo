#!/usr/bin/env node
/*
 * Importa a biblioteca de áudio exportada em
 * /Users/rafaelmendes/Documents/Codex/2026-09-16/con/outputs para a Rádio
 * Indoor. O processo é idempotente: não apaga arquivos locais nem objetos do
 * Wasabi, reaproveita objetos já enviados quando o hash confere e faz upsert
 * no catálogo da conta/loja informada.
 *
 * Uso (somente inventário):
 *   node --env-file=.env scripts/radio-indoor/import-output-library.mjs \
 *     --source /caminho/outputs --user-email rafael@jobvarejo.com.br
 *
 * Uso (envio + catálogo):
 *   node --env-file=.env scripts/radio-indoor/import-output-library.mjs \
 *     --source /caminho/outputs --user-email rafael@jobvarejo.com.br \
 *     --station-id UUID --execute
 */

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { Client } from 'pg'

const ROOT_DEFAULT = '/Users/rafaelmendes/Documents/Codex/2026-09-16/con/outputs'
const CURRENT_YEAR = new Date().getUTCFullYear()
const AUDIO_EXTENSIONS = new Set(['.webm', '.m4a', '.mp3'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const GOSPEL_ARTISTS = new Set([
  'aline barros',
  'cassiane',
  'fernandinho',
  'gabriela rocha',
  'isadora pompeo',
  'julliany souza',
  'thalles roberto'
])
const ARTIST_ALIASES = new Map([
  ['henrique e juliano', 'Henrique & Juliano'],
  ['bruno e marrone', 'Bruno & Marrone'],
  ['cesar menotti e fabiano', 'César Menotti & Fabiano'],
  ['diego e victor hugo', 'Diego & Victor Hugo'],
  ['hugo e guilherme', 'Hugo & Guilherme'],
  ['israel e rodolffo', 'Israel & Rodolffo'],
  ['jorge e mateus', 'Jorge & Mateus'],
  ['maiara e maraisa', 'Maiara & Maraisa'],
  ['matheus e kauan', 'Matheus & Kauan'],
  ['ze neto e cristiano', 'Zé Neto & Cristiano']
])

const argv = process.argv.slice(2)
const hasFlag = (flag) => argv.includes(flag)
const arg = (name, fallback = '') => {
  const index = argv.indexOf(name)
  return index >= 0 ? String(argv[index + 1] || fallback) : fallback
}

const sourceRoot = path.resolve(arg('--source', ROOT_DEFAULT))
const userEmail = arg('--user-email', 'rafael@jobvarejo.com.br').trim().toLowerCase()
const stationIdArg = arg('--station-id').trim()
const execute = hasFlag('--execute')
const skipAudio = hasFlag('--skip-audio')
const concurrency = Math.max(1, Math.min(20, Number.parseInt(arg('--concurrency', '8'), 10) || 8))
const statePath = path.resolve(arg('--state', '/tmp/jobvarejo-radio-import-plan.json'))
const reportPath = path.resolve(arg('--report', '/tmp/jobvarejo-radio-import-report.json'))
const maxRecords = Math.max(0, Number.parseInt(arg('--limit', '0'), 10) || 0)

const normalize = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' e ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const clean = (value, max = 240) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max)

// Referências de arquivo precisam conservar espaços repetidos e o Unicode do
// nome original; normalizá-las faria o importador procurar outro caminho.
const cleanFileReference = (value, max = 500) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .trim()
  .slice(0, max)

const slug = (value, fallback = 'sem-nome', max = 80) => {
  const result = clean(value, 180)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
  return result || fallback
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const relative = (filePath) => path.relative(sourceRoot, filePath).split(path.sep).join('/')
const isInside = (root, candidate) => {
  const resolvedRoot = path.resolve(root) + path.sep
  const resolvedCandidate = path.resolve(candidate)
  return resolvedCandidate === path.resolve(root) || resolvedCandidate.startsWith(resolvedRoot)
}
const isAudio = (filePath) => AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
const isImage = (filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
const isFormatComparison = (filePath) => /^comparacao de formatos(?:\/|$)/i.test(relative(filePath))

const parsePlaylistId = (url) => {
  const match = String(url || '').match(/[?&]list=([A-Za-z0-9_-]+)/i)
  return match?.[1] || null
}

const hashText = (value, size = 16) => createHash('sha1').update(String(value)).digest('hex').slice(0, size)

const canonicalArtist = (topFolder) => {
  const original = clean(topFolder, 180)
  const normalized = normalize(original)
  if (normalized.includes('gusttavo lima')) return 'Gusttavo Lima'
  if (ARTIST_ALIASES.has(normalized)) return ARTIST_ALIASES.get(normalized)
  return original || 'Artista desconhecido'
}

const artistVariants = (artist) => {
  const variants = [artist]
  if (artist.includes('&')) variants.push(artist.replace(/\s*&\s*/g, ' e '))
  if (artist.includes(' e ')) variants.push(artist.replace(/\s+e\s+/g, ' & '))
  return Array.from(new Set(variants.map((value) => clean(value)).filter(Boolean))).sort((a, b) => b.length - a.length)
}

const findYear = (...values) => {
  for (const value of values) {
    const matches = String(value || '').match(/\b(?:19\d{2}|20\d{2})\b/g) || []
    const valid = matches.map(Number).find((year) => year >= 1900 && year <= 2100)
    if (valid) return valid
  }
  return null
}

const normalizeAlbum = (folderName, artist, playlistTitle) => {
  let album = clean(folderName || playlistTitle || 'Biblioteca')
  const normalized = normalize(album)
  if (normalized.includes('menos e mais') && normalized.includes('henrique') && normalized.includes('juliano')) {
    return 'Menos É Mais (Ao Vivo)'
  }
  for (const variant of artistVariants(artist)) {
    const pattern = new RegExp(`\\s*[-–—|:]\\s*${escapeRegExp(variant)}\\s*$`, 'i')
    album = album.replace(pattern, '').trim()
  }
  album = album.replace(/^\s*(?:\d{1,3}\s*[-.)]\s*)+/, '').replace(/\s+/g, ' ').trim()
  return clean(album || playlistTitle || 'Biblioteca', 180)
}

const cleanTrackTitle = (rawTitle, fileName, artist) => {
  let title = clean(rawTitle || path.parse(fileName || '').name, 240)
  title = title.replace(/\s*\[[A-Za-z0-9_-]{8,}\]\s*$/g, '').trim()
  title = title.replace(/^\s*\d{1,4}\s*[-.)]\s*/g, '').trim()
  for (const variant of artistVariants(artist)) {
    const pattern = new RegExp(`^${escapeRegExp(variant)}\\s*(?:[-–—:|,]\\s*)`, 'i')
    if (pattern.test(title)) {
      title = title.replace(pattern, '').trim()
      break
    }
  }
  for (const variant of artistVariants(artist)) {
    const pattern = new RegExp(`\\s*[-–—|,]\\s*${escapeRegExp(variant)}\\s*$`, 'i')
    if (pattern.test(title)) {
      title = title.replace(pattern, '').trim()
      break
    }
  }
  title = title.replace(/^\s*\d{1,4}\s*[-.)]\s*/g, '').trim()
  return clean(title || path.parse(fileName || '').name || 'Faixa sem título', 240)
}

const featuredArtists = (title) => {
  const match = String(title).match(/\b(?:part\.?|feat\.?|ft\.?|com)\s+([^|()[\]]+)/i)
  if (!match) return []
  return match[1]
    .split(/\s+-\s+|\s+\|\s+/)[0]
    .split(/,\s*/)
    .map((item) => clean(item, 100))
    .filter(Boolean)
    .slice(0, 6)
}

const inferSubgenres = (text) => {
  const value = normalize(text)
  const result = []
  const tests = [
    ['ao-vivo', /\bao vivo\b|\blive\b|\bdvd\b/],
    ['acústico', /acustic/],
    ['romântico', /romantic|sofrenc|namorado|casais/],
    ['natal', /natal/],
    ['infantil', /infantil|crianca|kids|cia/],
    ['instrumental', /instrument/],
    ['karaokê', /karaok/],
    ['cover', /cover|vers[aã]o de f[aã]|f[aã]s/],
    ['podcast', /podcast/],
    ['devocional', /devocional|reflex[aã]o|pregac[aã]o|conferencia|palavra/],
    ['guia', /\bguia\b|aula|tutorial/],
    ['clipe', /clipe|videoclipe|lyric/]
  ]
  for (const [label, pattern] of tests) if (pattern.test(value)) result.push(label)
  return result
}

const inferContentType = (text) => {
  const value = normalize(text)
  return /podcast|entrevista|pregacao|devocional|reflexao|aula|tutorial|guia|agenda|bastidores|vlog|testemunho|conferencia|palavra|dicas?/.test(value)
    ? 'spoken'
    : 'music'
}

const mimeFor = (extension) => ({
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg'
}[extension.toLowerCase()] || 'application/octet-stream')

const albumTypeFor = (text) => {
  const value = normalize(text)
  if (/dvd|ao vivo|live/.test(value)) return 'live_album_dvd'
  if (/ep/.test(value)) return 'ep'
  if (/cd|album|disco/.test(value)) return 'studio_album'
  if (/playlist|melhores|favorites|hits|top/.test(value)) return 'playlist'
  return 'single'
}

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))

const walk = async (directory, onFile) => {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(filePath, onFile)
    else await onFile(filePath)
  }
}

const coverForDirectory = async (directory) => {
  let entries = []
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return null }
  const files = entries.filter((entry) => entry.isFile() && isImage(path.join(directory, entry.name)))
    .map((entry) => path.join(directory, entry.name))
  if (!files.length) return null
  const priority = /^(capa|cover|folder|thumb|thumbnail)(?:\.|-|_)/i
  return files.sort((a, b) => {
    const ap = priority.test(path.basename(a)) ? 0 : 1
    const bp = priority.test(path.basename(b)) ? 0 : 1
    return ap - bp || path.basename(a).localeCompare(path.basename(b), 'pt-BR')
  })[0]
}

const makeS3 = () => {
  const endpoint = String(process.env.WASABI_ENDPOINT || 's3.wasabisys.com')
    .replace(/^https?:\/\//i, '').replace(/\/$/, '')
  const region = process.env.WASABI_REGION || 'us-east-1'
  const accessKeyId = process.env.WASABI_ACCESS_KEY
  const secretAccessKey = process.env.WASABI_SECRET_KEY
  if (!accessKeyId || !secretAccessKey) throw new Error('WASABI_ACCESS_KEY/WASABI_SECRET_KEY não configuradas')
  return {
    bucket: process.env.WASABI_BUCKET || 'jobvarejo',
    client: new S3Client({
      region,
      endpoint: `https://${endpoint}`,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey }
    })
  }
}

const isNotFound = (error) => Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0) === 404 ||
  error?.name === 'NotFound' || error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey'

const headObject = async (s3, bucket, key) => {
  try {
    return await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

const retry = async (operation, label, attempts = 4) => {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation() } catch (error) {
      lastError = error
      if (attempt >= attempts) break
      const waitMs = Math.min(15_000, 800 * (2 ** (attempt - 1))) + Math.round(Math.random() * 250)
      console.error(`[retry] ${label}: tentativa ${attempt}/${attempts}; aguardando ${waitMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }
  throw lastError
}

const sha256File = (filePath) => new Promise((resolve, reject) => {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  stream.on('data', (chunk) => hash.update(chunk))
  stream.once('error', reject)
  stream.once('end', () => resolve(hash.digest('hex')))
})

const putFile = async (s3, bucket, filePath, key, contentType, sha256, sizeBytes) => {
  const existing = await headObject(s3, bucket, key)
  if (existing && Number(existing.ContentLength || 0) === Number(sizeBytes || 0) &&
      (!sha256 || String(existing.Metadata?.sha256 || '') === sha256)) {
    return { uploaded: false, reused: true, sizeBytes: Number(existing.ContentLength || sizeBytes || 0) }
  }
  await retry(
    () => s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: sizeBytes,
      ContentType: contentType,
      CacheControl: 'private, max-age=31536000, immutable',
      Metadata: { sha256, source: 'user-authorized-local-file' }
    })),
    `upload ${key}`
  )
  return { uploaded: true, reused: false, sizeBytes }
}

const putBuffer = async (s3, bucket, key, body, contentType, sha256) => {
  const existing = await headObject(s3, bucket, key)
  if (existing && Number(existing.ContentLength || 0) === body.length &&
      (!sha256 || String(existing.Metadata?.sha256 || '') === sha256)) {
    return { uploaded: false, reused: true }
  }
  await retry(
    () => s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentLength: body.length,
      ContentType: contentType,
      CacheControl: 'private, max-age=31536000, immutable',
      Metadata: sha256 ? { sha256, source: 'user-authorized-local-file' } : undefined
    })),
    `upload ${key}`
  )
  return { uploaded: true, reused: false }
}

const runPool = async (items, workers, handler) => {
  let cursor = 0
  const results = new Array(items.length)
  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      try { results[index] = await handler(items[index], index) } catch (error) { results[index] = { error } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, Math.max(1, items.length)) }, worker))
  return results
}

const scanLibrary = async () => {
  const inventoryPaths = []
  await walk(sourceRoot, async (filePath) => {
    if (path.basename(filePath).toLowerCase() === 'inventario.json') inventoryPaths.push(filePath)
  })
  inventoryPaths.sort((a, b) => relative(a).localeCompare(relative(b), 'pt-BR'))

  const inventories = []
  const referencedPaths = new Set()
  const rawRecords = []
  const skipped = []
  for (const inventoryPath of inventoryPaths) {
    let inventory
    try { inventory = await readJson(inventoryPath) } catch (error) {
      skipped.push({ type: 'inventory-json', path: relative(inventoryPath), reason: String(error?.message || error) })
      continue
    }
    const inventoryDirectory = path.dirname(inventoryPath)
    const topFolder = relative(inventoryDirectory).split('/')[0] || path.basename(sourceRoot)
    const playlistTitle = clean(inventory.playlist || path.basename(inventoryDirectory) || 'Biblioteca')
    const playlistUrl = clean(inventory.url || '', 2048) || null
    const playlistId = parsePlaylistId(playlistUrl)
    const entries = []
    const rows = Array.isArray(inventory.faixas) ? inventory.faixas : []
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {}
      const fileName = cleanFileReference(row.arquivo || '', 500)
      if (!fileName) continue
      const audioPath = path.resolve(inventoryDirectory, fileName)
      if (!isInside(sourceRoot, audioPath) || !isAudio(audioPath) || isFormatComparison(audioPath)) {
        skipped.push({ type: 'audio-reference', path: relative(inventoryPath), file: fileName, reason: 'arquivo fora da biblioteca ou formato de comparação' })
        continue
      }
      let info
      try { info = await stat(audioPath) } catch {
        skipped.push({ type: 'missing-audio', path: relative(inventoryPath), file: fileName, reason: 'arquivo listado não encontrado' })
        continue
      }
      const fileRecord = {
        filePath: audioPath,
        relativePath: relative(audioPath),
        inventoryPath,
        inventoryRelativePath: relative(inventoryPath),
        inventoryDirectory,
        topFolder,
        playlistTitle,
        playlistUrl,
        playlistId,
        playlistPosition: Number(row.posicao || row.position || index + 1) || index + 1,
        titleRaw: clean(row.titulo || '', 240),
        sourceIdRaw: clean(row.id || '', 180),
        durationSeconds: Number.isFinite(Number(row.duracao)) ? Number(row.duracao) : null,
        sourceCodec: clean(row.codec || '', 40) || null,
        sizeBytes: Number(row.bytes) > 0 ? Number(row.bytes) : Number(info.size),
        actualSizeBytes: Number(info.size),
        sourceExtra: row
      }
      referencedPaths.add(audioPath)
      rawRecords.push(fileRecord)
      entries.push(fileRecord)
    }
    inventories.push({
      path: inventoryPath,
      relativePath: relative(inventoryPath),
      directory: inventoryDirectory,
      relativeDirectory: relative(inventoryDirectory),
      topFolder,
      playlistTitle,
      playlistUrl,
      playlistId,
      sourcePublisher: clean(inventory.sourcePublisher || inventory.channel || inventory.canal || '', 180) || null,
      entries
    })
  }

  // Inclui arquivos de áudio extras que não foram listados em inventários,
  // exceto os três arquivos usados somente para comparar formatos.
  const allAudioCandidatePaths = []
  await walk(sourceRoot, async (filePath) => {
    if (isAudio(filePath)) allAudioCandidatePaths.push(filePath)
  })
  for (const audioPath of allAudioCandidatePaths.filter((filePath) => !isFormatComparison(filePath)).sort((a, b) => relative(a).localeCompare(relative(b), 'pt-BR'))) {
    if (referencedPaths.has(audioPath)) continue
    let info
    try { info = await stat(audioPath) } catch { continue }
    const relParts = relative(audioPath).split('/')
    const topFolder = relParts[0] || path.basename(sourceRoot)
    const directory = path.dirname(audioPath)
    const playlistTitle = clean(path.basename(directory) || topFolder)
    const row = {
      filePath: audioPath,
      relativePath: relative(audioPath),
      inventoryPath: null,
      inventoryRelativePath: null,
      inventoryDirectory: directory,
      topFolder,
      playlistTitle,
      playlistUrl: null,
      playlistId: null,
      playlistPosition: 0,
      titleRaw: path.parse(audioPath).name,
      sourceIdRaw: '',
      durationSeconds: null,
      sourceCodec: null,
      sizeBytes: Number(info.size),
      actualSizeBytes: Number(info.size),
      sourceExtra: { unlistedAudio: true }
    }
    rawRecords.push(row)
    skipped.push({ type: 'unlisted-audio-included', path: row.relativePath, reason: 'arquivo sem inventário foi incluído como mídia local' })
  }

  const bySource = new Map()
  for (const row of rawRecords) {
    const key = row.sourceIdRaw ? `youtube:${row.sourceIdRaw}` : `local:${row.relativePath}`
    const current = bySource.get(key)
    if (!current) {
      bySource.set(key, { selected: row, occurrences: [row] })
      continue
    }
    current.occurrences.push(row)
    const selected = current.selected
    const candidateIsBetter = row.actualSizeBytes > selected.actualSizeBytes ||
      (row.actualSizeBytes === selected.actualSizeBytes && row.relativePath.localeCompare(selected.relativePath, 'pt-BR') < 0)
    if (candidateIsBetter) current.selected = row
  }

  const records = []
  const recordByKey = new Map()
  for (const [sourceKey, value] of bySource) {
    const row = value.selected
    const artist = canonicalArtist(row.topFolder)
    const playlistContext = `${row.playlistTitle} ${row.relativePath}`
    const album = normalizeAlbum(path.basename(row.inventoryDirectory), artist, row.playlistTitle)
    // O ano da discografia vem da pasta/playlist. O título pode conter um
    // ano de entrevista, podcast ou evento e não deve virar ano do álbum.
    const year = findYear(path.basename(row.inventoryDirectory), row.playlistTitle, row.relativePath.split('/').slice(0, -1).join('/'))
    const genre = GOSPEL_ARTISTS.has(normalize(artist)) || /\bgospel\b|louvor|adoracao|devocional|pregac[aã]o|conferencia/.test(normalize(playlistContext))
      ? 'Gospel'
      : 'Sertanejo'
    const title = cleanTrackTitle(row.titleRaw, path.basename(row.filePath), artist)
    const subgenres = inferSubgenres(`${row.playlistTitle} ${path.basename(row.inventoryDirectory)} ${title}`)
    const contentType = inferContentType(`${row.playlistTitle} ${path.basename(row.inventoryDirectory)} ${title}`)
    const extension = path.extname(row.filePath).toLowerCase()
    const sourceProvider = row.sourceIdRaw ? 'youtube' : 'local-library'
    const sourceId = row.sourceIdRaw ? `yt-${row.sourceIdRaw}` : `local-${hashText(row.relativePath, 24)}`
    const groupKey = [genre, artist, year || 'sem-ano', album].map((item) => normalize(item)).join('|')
    const coverSourcePath = await coverForDirectory(row.inventoryDirectory)
    const sourceUrl = row.playlistUrl || (row.sourceIdRaw ? `https://www.youtube.com/watch?v=${encodeURIComponent(row.sourceIdRaw)}` : null)
    const record = {
      sourceKey,
      sourceProvider,
      sourceId,
      videoId: row.sourceIdRaw || null,
      filePath: row.filePath,
      relativePath: row.relativePath,
      inventoryPath: row.inventoryPath,
      inventoryRelativePath: row.inventoryRelativePath,
      inventoryDirectory: row.inventoryDirectory,
      topFolder: row.topFolder,
      playlistTitle: row.playlistTitle,
      playlistUrl: row.playlistUrl,
      playlistId: row.playlistId,
      playlistPosition: row.playlistPosition,
      title,
      titleRaw: row.titleRaw,
      artist,
      featuredArtists: featuredArtists(title),
      album,
      albumType: albumTypeFor(`${album} ${row.playlistTitle}`),
      year,
      releaseDate: null,
      genre,
      subgenres,
      contentType,
      language: 'pt-BR',
      durationSeconds: row.durationSeconds,
      sourceCodec: row.sourceCodec || (extension === '.webm' ? 'opus' : extension === '.m4a' ? 'aac' : extension === '.mp3' ? 'mp3' : null),
      extension,
      contentTypeMime: mimeFor(extension),
      sizeBytes: row.actualSizeBytes,
      sourceExtra: row.sourceExtra,
      occurrences: value.occurrences.map((item) => ({
        relativePath: item.relativePath,
        inventoryRelativePath: item.inventoryRelativePath,
        playlistPosition: item.playlistPosition,
        sizeBytes: item.actualSizeBytes
      })),
      coverSourcePath,
      groupKey,
      selectedReason: value.occurrences.length > 1 ? 'maior arquivo entre ocorrências do mesmo ID' : 'única ocorrência'
    }
    recordByKey.set(sourceKey, record)
    records.push(record)
  }

  records.sort((a, b) => a.genre.localeCompare(b.genre, 'pt-BR') ||
    a.artist.localeCompare(b.artist, 'pt-BR') ||
    ((a.year || 9999) - (b.year || 9999)) ||
    a.album.localeCompare(b.album, 'pt-BR') ||
    a.title.localeCompare(b.title, 'pt-BR') ||
    a.sourceId.localeCompare(b.sourceId))

  const selectedRecords = maxRecords ? records.slice(0, maxRecords) : records
  const selectedRecordKeys = new Set(selectedRecords.map((record) => record.sourceKey))
  const groupCounters = new Map()
  const usedAudioKeys = new Set()
  const groups = new Map()
  for (const record of records) {
    if (!selectedRecordKeys.has(record.sourceKey)) continue
    const groupPosition = (groupCounters.get(record.groupKey) || 0) + 1
    groupCounters.set(record.groupKey, groupPosition)
    const genrePart = slug(record.genre)
    const artistPart = slug(record.artist)
    const yearPart = record.year ? String(record.year) : 'sem-ano'
    const albumPart = slug(record.album)
    const positionPart = String(groupPosition).padStart(3, '0')
    const titlePart = slug(record.title, 'faixa')
    let audioKey = `radio-indoor/catalog/audio/${genrePart}/${artistPart}/${yearPart}/${albumPart}/${positionPart}-${titlePart}${record.extension}`
    if (usedAudioKeys.has(audioKey)) audioKey = audioKey.replace(record.extension, `-${slug(record.sourceId, 'fonte', 30)}${record.extension}`)
    usedAudioKeys.add(audioKey)
    record.groupPosition = groupPosition
    record.audioKey = audioKey
    if (!groups.has(record.groupKey)) groups.set(record.groupKey, { key: record.groupKey, genre: record.genre, artist: record.artist, year: record.year, album: record.album, coverSourcePath: record.coverSourcePath, records: [] })
    const group = groups.get(record.groupKey)
    if (!group.coverSourcePath && record.coverSourcePath) group.coverSourcePath = record.coverSourcePath
    group.records.push(record)
  }

  const allInventoryEntries = inventories.flatMap((inventory) => inventory.entries)
  const inventoryTrackMap = new Map()
  for (const inventory of inventories) {
    const seen = new Set()
    const entries = []
    for (const sourceEntry of inventory.entries) {
      const key = sourceEntry.sourceIdRaw ? `youtube:${sourceEntry.sourceIdRaw}` : `local:${sourceEntry.relativePath}`
      if (seen.has(key)) continue
      const record = recordByKey.get(key)
      if (!record || !selectedRecordKeys.has(record.sourceKey)) continue
      seen.add(key)
      entries.push(record)
    }
    inventoryTrackMap.set(inventory.relativePath, entries.sort((a, b) => a.playlistPosition - b.playlistPosition || a.title.localeCompare(b.title, 'pt-BR')))
  }

  const uniqueDuplicateCount = rawRecords.length - records.length
  const unlistedIncluded = skipped.filter((item) => item.type === 'unlisted-audio-included').length
  const comparisonExcluded = allAudioCandidatePaths.filter(isFormatComparison).length
  const totalBytes = records.reduce((sum, record) => sum + record.sizeBytes, 0)
  return {
    generatedAt: new Date().toISOString(),
    sourceRoot,
    inventories,
    records: selectedRecords,
    groups,
    inventoryTrackMap,
    skipped,
    stats: {
      inventories: inventories.length,
      rawAudioFiles: rawRecords.length,
      uniqueTracks: records.length,
      duplicateOccurrencesRemoved: uniqueDuplicateCount,
      unlistedAudioIncluded: unlistedIncluded,
      formatComparisonExcluded: comparisonExcluded,
      totalBytes,
      totalGiB: Number((totalBytes / (1024 ** 3)).toFixed(2)),
      missingReferences: skipped.filter((item) => item.type === 'missing-audio').length,
      groups: new Set(records.map((record) => record.groupKey)).size,
      artists: new Set(records.map((record) => record.artist)).size,
      genres: new Set(records.map((record) => record.genre)).size
    }
  }
}

const audioManifest = (record, importedAt) => ({
  status: record.audioStatus || 'pending',
  source: 'user-provided-local-file',
  rightsStatus: 'authorized_by_user',
  storageKey: record.audioKey,
  format: record.extension.slice(1),
  container: record.extension.slice(1),
  codec: record.sourceCodec || null,
  sampleRate: record.sampleRate || null,
  channels: record.channels || null,
  durationSeconds: record.durationSeconds,
  sizeBytes: record.sizeBytes,
  sha256: record.sha256 || null,
  contentType: record.contentTypeMime,
  importedAt: importedAt || null
})

const trackManifest = (record, importedAt) => ({
  trackId: record.sourceId,
  position: record.playlistPosition || record.groupPosition || 1,
  title: record.title,
  artist: record.artist,
  featuredArtists: record.featuredArtists,
  album: record.album,
  albumType: record.albumType,
  year: record.year,
  releaseDate: record.releaseDate,
  recordedYear: record.year,
  genre: record.genre,
  tags: Array.from(new Set([normalize(record.genre), ...record.subgenres, record.language === 'pt-BR' ? 'português' : record.language])),
  language: record.language,
  durationSeconds: record.durationSeconds,
  source: {
    provider: record.sourceProvider === 'youtube' ? 'YouTube' : 'local-library',
    playlistId: record.playlistId,
    videoId: record.videoId,
    url: record.videoId
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(record.videoId)}${record.playlistId ? `&list=${encodeURIComponent(record.playlistId)}` : ''}`
      : record.playlistUrl,
    channel: record.artist,
    playlistTitle: record.playlistTitle,
    playlistPublisher: 'Inventário local'
  },
  thumbnail: {
    sourceUrl: record.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(record.videoId)}/hqdefault.jpg` : null,
    storageKey: record.thumbnailKey || record.coverKey || null,
    format: record.thumbnailKey || record.coverKey ? 'webp' : null,
    status: record.thumbnailKey || record.coverKey ? 'cached_as_album_cover' : 'unavailable'
  },
  audio: audioManifest(record, importedAt),
  catalog: {
    status: record.audioStatus === 'ready' ? 'ready' : 'pending',
    rightsStatus: 'authorized_by_user',
    contentType: record.contentType,
    virtualPath: `${record.genre}/${record.artist}/${record.year || 'Sem ano'} - ${record.album}/${String(record.groupPosition || 1).padStart(2, '0')} - ${record.title}`
  },
  metadata: {
    originalTitle: record.titleRaw || null,
    originalRelativePath: record.relativePath,
    inventoryRelativePath: record.inventoryRelativePath,
    playlistPosition: record.playlistPosition || null,
    duplicateOccurrences: record.occurrences,
    selectedReason: record.selectedReason,
    metadataConfidence: {
      artist: 'top-level-folder',
      album: 'inventory-directory',
      year: record.year ? 'explicit-year-in-folder-or-title' : 'unknown',
      genre: 'artist-and-folder-classification',
      releaseDate: 'not-present-in-local-inventory'
    },
    missingSourceFields: ['releaseDate', 'sampleRate', 'channels']
  }
})

const makeCoverObject = async (group) => {
  if (!group.coverSourcePath) return null
  const sourceInfo = await stat(group.coverSourcePath)
  const key = `radio-indoor/catalog/covers/${slug(group.genre)}/${slug(group.artist)}/${group.year || 'sem-ano'}/${slug(group.album)}.webp`
  let body
  try {
    const sharpModule = await import('sharp')
    const sharpFactory = sharpModule.default || sharpModule
    body = await sharpFactory(group.coverSourcePath).webp({ quality: 84, effort: 4 }).toBuffer()
  } catch {
    body = await readFile(group.coverSourcePath)
  }
  const outputFormat = path.extname(group.coverSourcePath).toLowerCase() === '.webp' ? 'webp' : 'webp'
  const contentType = outputFormat === 'webp' ? 'image/webp' : 'image/jpeg'
  return {
    sourcePath: group.coverSourcePath,
    sourceRelativePath: relative(group.coverSourcePath),
    sourceSizeBytes: Number(sourceInfo.size),
    key,
    body,
    format: outputFormat,
    contentType,
    sha256: createHash('sha256').update(body).digest('hex')
  }
}

const printSummary = (plan) => {
  const byGenre = {}
  const byArtist = {}
  const years = { known: 0, unknown: 0 }
  const content = { music: 0, spoken: 0 }
  for (const record of plan.records) {
    byGenre[record.genre] = (byGenre[record.genre] || 0) + 1
    byArtist[record.artist] = (byArtist[record.artist] || 0) + 1
    if (record.year) years.known += 1
    else years.unknown += 1
    content[record.contentType] = (content[record.contentType] || 0) + 1
  }
  console.log(JSON.stringify({
    mode: execute ? 'execute' : 'inventory-only',
    sourceRoot,
    userEmail,
    stationId: stationIdArg || null,
    stats: plan.stats,
    selectedAfterLimit: plan.records.length,
    years,
    content,
    genres: byGenre,
    artists: byArtist
  }, null, 2))
}

const makePlaylistManifest = (inventory, tracks, importedAt) => {
  const artists = Array.from(new Set(tracks.map((track) => track.artist)))
  const albums = Array.from(new Set(tracks.map((track) => track.album)))
  const years = Array.from(new Set(tracks.map((track) => track.year).filter(Boolean)))
  const genres = Array.from(new Set(tracks.map((track) => track.genre)))
  const firstWithCover = tracks.find((track) => track.coverKey)
  const playlistId = inventory.playlistId || `local-${hashText(inventory.relativePath, 24)}`
  const title = inventory.playlistTitle || path.basename(inventory.directory)
  return {
    schemaVersion: 1,
    type: 'radio-indoor-import-manifest',
    generatedAt: importedAt,
    playlist: {
      id: playlistId,
      title,
      album: albums.length === 1 ? albums[0] : null,
      artist: artists.length === 1 ? artists[0] : null,
      year: years.length === 1 ? years[0] : null,
      releaseDate: null,
      genre: genres.length === 1 ? genres[0] : 'Múltiplos',
      language: 'pt-BR',
      sourceUrl: inventory.playlistUrl,
      sourcePublisher: inventory.sourcePublisher || 'Inventário local',
      trackCount: tracks.length,
      cover: firstWithCover?.coverKey ? {
        status: 'ready',
        source: 'user-provided-local-file',
        storageKey: firstWithCover.coverKey,
        format: 'webp',
        contentType: 'image/webp',
        sourceRelativePath: firstWithCover.coverSourceRelativePath || null
      } : null,
      audioReadyCount: tracks.filter((track) => track.audioStatus === 'ready').length
    },
    importPolicy: {
      metadata: 'captured-and-inferred-with-provenance',
      thumbnails: 'album-covers-cached-as-webp',
      audio: 'uploaded-from-user-provided-files',
      nextStep: 'configure-programming-with-authorized-audio-library',
      audioFormats: ['webm/opus', 'm4a/aac', 'mp3'],
      authorization: 'user_authorized_files'
    },
    tracks: tracks.map((track) => trackManifest(track, importedAt)),
    updatedAt: importedAt,
    audio: {
      readyCount: tracks.filter((track) => track.audioStatus === 'ready').length,
      totalCount: tracks.length,
      formats: Array.from(new Set(tracks.map((track) => track.extension.slice(1)))),
      storagePrefix: tracks[0]?.audioKey?.split('/').slice(0, -1).join('/') + '/' || 'radio-indoor/catalog/audio/'
    }
  }
}

const upsertCatalog = async (db, plan, userId, stationId, importedAt) => {
  const readyRecords = plan.records.filter((record) => record.audioStatus === 'ready')
  await db.query('BEGIN')
  try {
    const trackIds = new Map()
    for (const record of readyRecords) {
      const metadata = {
        importedFrom: record.inventoryRelativePath || 'local-output-library',
        importedAt,
        source: 'user-provided-local-file',
        originalRelativePath: record.relativePath,
        inventoryRelativePath: record.inventoryRelativePath,
        playlistTitle: record.playlistTitle,
        playlistId: record.playlistId,
        playlistPosition: record.playlistPosition || null,
        groupPosition: record.groupPosition,
        featuredArtists: record.featuredArtists,
        contentType: record.contentType,
        audio: {
          sha256: record.sha256,
          sizeBytes: record.sizeBytes,
          durationSeconds: record.durationSeconds,
          format: record.extension.slice(1),
          codec: record.sourceCodec || null,
          contentType: record.contentTypeMime
        },
        metadataConfidence: {
          artist: 'top-level-folder',
          album: 'inventory-directory',
          year: record.year ? 'explicit-year-in-folder-or-title' : 'unknown',
          genre: 'artist-and-folder-classification',
          releaseDate: 'not-present-in-local-inventory'
        },
        missingSourceFields: ['releaseDate', 'sampleRate', 'channels'],
        duplicateOccurrences: record.occurrences,
        selectedReason: record.selectedReason
      }
      const sourceUrl = record.videoId
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(record.videoId)}${record.playlistId ? `&list=${encodeURIComponent(record.playlistId)}` : ''}`
        : record.playlistUrl
      const result = await db.query(
        `insert into public.radio_catalog_tracks
          (user_id, station_id, title, artist, album, release_year, release_date, genre, subgenres, language,
           duration_ms, source_url, source_provider, source_id, storage_key, thumbnail_key, thumbnail_source_url,
           audio_format, audio_codec, rights_status, status, metadata)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'ready',$21::jsonb)
         on conflict (user_id, source_provider, source_id) do update set
           station_id = coalesce(radio_catalog_tracks.station_id, excluded.station_id),
           title = excluded.title, artist = excluded.artist, album = excluded.album,
           release_year = coalesce(excluded.release_year, radio_catalog_tracks.release_year),
           release_date = coalesce(excluded.release_date, radio_catalog_tracks.release_date),
           genre = excluded.genre, subgenres = excluded.subgenres, language = excluded.language,
           duration_ms = excluded.duration_ms,
           source_url = coalesce(excluded.source_url, radio_catalog_tracks.source_url),
           storage_key = excluded.storage_key, thumbnail_key = excluded.thumbnail_key,
           thumbnail_source_url = coalesce(excluded.thumbnail_source_url, radio_catalog_tracks.thumbnail_source_url),
           audio_format = excluded.audio_format, audio_codec = excluded.audio_codec,
           rights_status = excluded.rights_status, status = 'ready', metadata = excluded.metadata, updated_at = now()
         returning id`,
        [
          userId,
          stationId,
          record.title,
          record.artist,
          record.album || null,
          record.year || null,
          record.releaseDate || null,
          record.genre,
          record.subgenres,
          record.language,
          Number.isFinite(Number(record.durationSeconds)) ? Math.round(Number(record.durationSeconds) * 1000) : null,
          sourceUrl,
          record.sourceProvider,
          record.sourceId,
          record.audioKey,
          record.thumbnailKey || record.coverKey || null,
          record.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(record.videoId)}/hqdefault.jpg` : null,
          record.extension.slice(1),
          record.sourceCodec || null,
          'authorized_by_user',
          JSON.stringify(metadata)
        ]
      )
      const id = result.rows[0]?.id
      if (id) trackIds.set(record.sourceKey, id)
    }

    const makePlaylist = async (name, description, kind, records, coverKey = null, settings = {}) => {
      const playlistName = clean(name, 160)
      const existing = await db.query(
        `select id from public.radio_playlists where user_id=$1 and station_id=$2 and name=$3 limit 1`,
        [userId, stationId, playlistName]
      )
      let playlistId = existing.rows[0]?.id
      if (!playlistId) {
        const result = await db.query(
          `insert into public.radio_playlists (user_id, station_id, name, description, kind, cover_key, settings)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb) returning id`,
          [userId, stationId, playlistName, clean(description, 500), kind, coverKey, JSON.stringify(settings)]
        )
        playlistId = result.rows[0]?.id
      } else {
        await db.query(
          `update public.radio_playlists
              set description=$1, kind=$2, cover_key=coalesce($3, cover_key), settings=$4::jsonb, updated_at=now()
            where id=$5`,
          [clean(description, 500), kind, coverKey, JSON.stringify(settings), playlistId]
        )
      }
      if (!playlistId) throw new Error(`Não foi possível criar a playlist ${playlistName}`)
      const ids = records.map((record) => trackIds.get(record.sourceKey)).filter(Boolean)
      if (ids.length) {
        await db.query(
          `insert into public.radio_playlist_items (playlist_id, track_id, position)
           select $1, value::uuid, ordinality - 1
             from unnest($2::text[]) with ordinality as u(value, ordinality)
           on conflict (playlist_id, track_id) do update set position = excluded.position`,
          [playlistId, ids]
        )
      }
      return { id: playlistId, name: playlistName, count: ids.length }
    }

    const musicRecords = readyRecords.filter((record) => record.contentType === 'music')
    const playlists = []
    playlists.push(await makePlaylist(
      'Biblioteca completa — Rádio Indoor',
      'Catálogo completo importado do diretório local; contém música e conteúdo falado para organização posterior.',
      'system',
      readyRecords,
      null,
      { source: 'radio-output-library', importedAt, catalogScope: 'all' }
    ))
    playlists.push(await makePlaylist(
      'Músicas — Rádio Indoor',
      'Faixas musicais prontas para programação; conteúdos falados ficam disponíveis no catálogo.',
      'system',
      musicRecords,
      null,
      { source: 'radio-output-library', importedAt, catalogScope: 'music' }
    ))
    for (const genre of Array.from(new Set(musicRecords.map((record) => record.genre))).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
      const subset = musicRecords.filter((record) => record.genre === genre)
      playlists.push(await makePlaylist(
        `Músicas — ${genre}`,
        `Catálogo musical classificado como ${genre}.`,
        'genre',
        subset,
        subset.find((record) => record.coverKey)?.coverKey || null,
        { source: 'radio-output-library', importedAt, genre }
      ))
    }
    for (const artist of Array.from(new Set(musicRecords.map((record) => record.artist))).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
      const subset = musicRecords.filter((record) => record.artist === artist)
      playlists.push(await makePlaylist(
        `Músicas — ${artist}`,
        `Discografia organizada de ${artist}.`,
        'artist',
        subset,
        subset.find((record) => record.coverKey)?.coverKey || null,
        { source: 'radio-output-library', importedAt, artist }
      ))
    }
    await db.query('COMMIT')
    return { readyTracks: readyRecords.length, trackIds, playlists }
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  }
}

const executePlan = async (plan) => {
  const { bucket, client: s3 } = makeS3()
  if (!process.env.POSTGRES_DATABASE_URL && !process.env.DATABASE_URL) throw new Error('POSTGRES_DATABASE_URL/DATABASE_URL não configuradas')
  const dbConnectionString = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL
  let db = new Client({ connectionString: dbConnectionString })
  // O cliente precisa de um listener mesmo durante a fase longa de upload;
  // a conexão é fechada e reaberta antes da transação do catálogo.
  db.on('error', () => {})
  await db.connect()
  let user
  let station
  try {
    user = (await db.query(
      `select id, email, role from public.profiles where lower(email) = lower($1) limit 1`,
      [userEmail]
    )).rows[0]
    if (!user) throw new Error(`Usuário não encontrado: ${userEmail}`)
    if (stationIdArg) {
      station = (await db.query(
        `select id, user_id, name, slug from public.radio_stations where id = $1 and user_id = $2 limit 1`,
        [stationIdArg, user.id]
      )).rows[0]
      if (!station) throw new Error('A loja informada não pertence ao usuário ou não existe')
    } else {
      station = (await db.query(
        `select id, user_id, name, slug from public.radio_stations where user_id = $1 and slug = 'radio-indoor' limit 1`,
        [user.id]
      )).rows[0]
      if (!station) throw new Error('Informe --station-id ou crie a estação radio-indoor antes da importação')
    }
    const existingRows = await db.query(
      `select source_provider, source_id, storage_key, thumbnail_key, metadata
         from public.radio_catalog_tracks where user_id = $1`,
      [user.id]
    )
    const existingBySource = new Map(existingRows.rows.map((row) => [`${row.source_provider}:${row.source_id}`, row]))
    await db.end().catch(() => {})
    db = null
    const importedAt = new Date().toISOString()
    const report = {
      success: true,
      startedAt: importedAt,
      sourceRoot,
      bucket,
      user: { id: user.id, email: user.email, role: user.role },
      station: { id: station.id, name: station.name },
      stats: plan.stats,
      audio: { attempted: plan.records.length, uploaded: 0, reused: 0, failed: 0, bytes: 0, failures: [] },
      covers: { attempted: 0, uploaded: 0, reused: 0, failed: 0, failures: [] },
      metadata: { tracksUploaded: 0, manifestsUploaded: 0, indexesUploaded: 0, failures: [] },
      database: null
    }

    const groups = Array.from(plan.groups.values())
    const coverObjects = (await Promise.all(groups.map(async (group) => {
      try {
        const cover = await makeCoverObject(group)
        return cover ? { group, cover } : null
      } catch (error) {
        report.covers.failed += 1
        report.covers.failures.push({ group: group.key, path: relative(group.coverSourcePath || ''), error: String(error?.message || error) })
        return null
      }
    }))).filter(Boolean)
    const coverByGroup = new Map()
    report.covers.attempted = coverObjects.length
    const coverResults = await runPool(coverObjects, Math.min(concurrency, 8), async ({ group, cover }) => {
      try {
        const result = await putBuffer(s3, bucket, cover.key, cover.body, cover.contentType, cover.sha256)
        return { group, cover, result }
      } catch (error) {
        return { group, cover, error }
      }
    })
    for (const item of coverResults) {
      if (item?.error) {
        report.covers.failed += 1
        report.covers.failures.push({ group: item.group.key, key: item.cover.key, error: String(item.error?.message || item.error) })
      } else if (item?.cover) {
        if (item.result?.reused) report.covers.reused += 1
        else report.covers.uploaded += 1
        coverByGroup.set(item.group.key, item.cover)
      }
    }
    for (const record of plan.records) {
      const cover = coverByGroup.get(record.groupKey)
      if (cover) {
        record.coverKey = cover.key
        record.coverSourceRelativePath = cover.sourceRelativePath
        record.thumbnailKey = cover.key
      }
    }

    if (skipAudio) {
      // Retomada rápida: os objetos de áudio já foram enviados. Confirma a
      // existência e lê o hash do próprio objeto, sem reler dezenas de GiB.
      let completed = 0
      const audioResults = await runPool(plan.records, concurrency, async (record) => {
        const sourceKey = `${record.sourceProvider}:${record.sourceId}`
        const existing = existingBySource.get(sourceKey)
        const candidateKey = existing?.storage_key || record.audioKey
        const head = await headObject(s3, bucket, candidateKey)
        if (!head) throw new Error(`Objeto de áudio não encontrado: ${candidateKey}`)
        record.audioKey = candidateKey
        record.audioStatus = 'ready'
        record.audioReused = true
        record.importedAt = importedAt
        record.sizeBytes = Number(head.ContentLength || record.sizeBytes)
        record.sha256 = String(head.Metadata?.sha256 || '') || null
        completed += 1
        report.audio.reused += 1
        if (completed % 100 === 0 || completed === plan.records.length) console.log(`[áudio retomado] ${completed}/${plan.records.length}`)
        return { reused: true, sizeBytes: 0 }
      })
      for (const [index, result] of audioResults.entries()) {
        if (result?.error) {
          const record = plan.records[index]
          record.audioStatus = 'failed'
          report.audio.failed += 1
          report.audio.failures.push({ sourceId: record.sourceId, path: record.relativePath, error: String(result.error?.message || result.error) })
        }
      }
    } else {
      let completed = 0
      const audioResults = await runPool(plan.records, concurrency, async (record) => {
        const sourceKey = `${record.sourceProvider}:${record.sourceId}`
        const existing = existingBySource.get(sourceKey)
        const sha256 = await sha256File(record.filePath)
        record.sha256 = sha256
        const existingAudio = existing?.metadata?.audio || {}
        if (existing?.storage_key && (String(existingAudio.sha256 || '') === sha256 || Number(existingAudio.sizeBytes || 0) === record.sizeBytes)) {
          const existingHead = await headObject(s3, bucket, existing.storage_key)
          if (existingHead && Number(existingHead.ContentLength || 0) === record.sizeBytes) {
            record.audioKey = existing.storage_key
            record.audioStatus = 'ready'
            record.audioReused = true
            record.importedAt = importedAt
            report.audio.reused += 1
            completed += 1
            if (completed % 25 === 0 || completed === plan.records.length) console.log(`[áudio] ${completed}/${plan.records.length}`)
            return { reused: true, sizeBytes: 0 }
          }
        }
        const result = await putFile(s3, bucket, record.filePath, record.audioKey, record.contentTypeMime, sha256, record.sizeBytes)
        record.audioStatus = 'ready'
        record.audioReused = result.reused
        record.importedAt = importedAt
        completed += 1
        if (result.reused) report.audio.reused += 1
        else { report.audio.uploaded += 1; report.audio.bytes += record.sizeBytes }
        if (completed % 25 === 0 || completed === plan.records.length) console.log(`[áudio] ${completed}/${plan.records.length}`)
        return result
      })
      for (const [index, result] of audioResults.entries()) {
        if (result?.error) {
          const record = plan.records[index]
          record.audioStatus = 'failed'
          report.audio.failed += 1
          report.audio.failures.push({ sourceId: record.sourceId, path: record.relativePath, error: String(result.error?.message || result.error) })
        }
      }
    }

    const readyRecords = plan.records.filter((record) => record.audioStatus === 'ready')
    const putJson = async (key, object) => {
      const body = Buffer.from(JSON.stringify(object, null, 2))
      const sha256 = createHash('sha256').update(body).digest('hex')
      const result = await putBuffer(s3, bucket, key, body, 'application/json; charset=utf-8', sha256)
      if (result.reused) report.metadata.reused = (report.metadata.reused || 0) + 1
      else report.metadata.uploaded = (report.metadata.uploaded || 0) + 1
      return result
    }
    const trackMetadataResults = await runPool(readyRecords, concurrency, async (record) => {
      try {
        await putJson(`radio-indoor/catalog/metadata/tracks/${record.sourceId}.json`, trackManifest(record, importedAt))
        return { record }
      } catch (error) {
        return { record, error }
      }
    })
    for (const item of trackMetadataResults) {
      if (item?.error) report.metadata.failures.push({ type: 'track', sourceId: item.record.sourceId, error: String(item.error?.message || item.error) })
      else report.metadata.tracksUploaded += 1
    }
    for (const inventory of plan.inventories) {
      const tracks = (plan.inventoryTrackMap.get(inventory.relativePath) || []).filter((record) => record.audioStatus === 'ready')
      if (!tracks.length) continue
      const owner = slug(tracks[0].artist || inventory.topFolder)
      const year = Array.from(new Set(tracks.map((track) => track.year).filter(Boolean))).length === 1
        ? Array.from(new Set(tracks.map((track) => track.year).filter(Boolean)))[0]
        : 'sem-ano'
      const key = `radio-indoor/catalog/metadata/playlists/${owner}/${slug(inventory.playlistTitle)}-${year}-${hashText(inventory.relativePath, 8)}.json`
      try {
        await putJson(key, makePlaylistManifest(inventory, tracks, importedAt))
        report.metadata.manifestsUploaded += 1
      } catch (error) {
        report.metadata.failures.push({ type: 'playlist', inventory: inventory.relativePath, error: String(error?.message || error) })
      }
    }
    const consolidatedKey = `radio-indoor/catalog/metadata/playlists/jobvarejo/radio-library-${CURRENT_YEAR}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-${String(new Date().getUTCDate()).padStart(2, '0')}.json`
    try {
      const consolidated = makePlaylistManifest({
        relativePath: 'radio-library',
        playlistTitle: 'Rádio Indoor — Biblioteca completa',
        playlistUrl: null,
        playlistId: `radio-library-${CURRENT_YEAR}`,
        sourcePublisher: 'Inventário local'
      }, readyRecords, importedAt)
      consolidated.playlist.genre = 'Múltiplos'
      consolidated.playlist.artist = null
      consolidated.playlist.album = null
      consolidated.playlist.year = null
      await putJson(consolidatedKey, consolidated)
      report.metadata.consolidatedManifestKey = consolidatedKey
      report.metadata.manifestsUploaded += 1
    } catch (error) {
      report.metadata.failures.push({ type: 'consolidated-manifest', error: String(error?.message || error) })
    }
    for (const group of groups) {
      const tracks = group.records.filter((record) => record.audioStatus === 'ready')
      if (!tracks.length) continue
      const key = `radio-indoor/catalog/indexes/genre/${slug(group.genre)}/${slug(group.artist)}/${group.year || 'sem-ano'}-${slug(group.album)}.json`
      try {
        await putJson(key, {
          schemaVersion: 1,
          type: 'radio-indoor-genre-index',
          generatedAt: importedAt,
          genre: group.genre,
          artist: group.artist,
          album: group.album,
          year: group.year,
          coverKey: tracks.find((record) => record.coverKey)?.coverKey || null,
          trackCount: tracks.length,
          trackIds: tracks.map((record) => record.sourceId),
          sourceRelativePaths: Array.from(new Set(tracks.map((record) => record.inventoryRelativePath).filter(Boolean)))
        })
        report.metadata.indexesUploaded += 1
      } catch (error) {
        report.metadata.failures.push({ type: 'index', group: group.key, error: String(error?.message || error) })
      }
    }

    db = new Client({ connectionString: dbConnectionString })
    db.on('error', () => {})
    await db.connect()
    const dbResult = await upsertCatalog(db, plan, user.id, station.id, importedAt)
    report.database = {
      readyTracks: dbResult.readyTracks,
      playlists: dbResult.playlists,
      playlistCount: dbResult.playlists.length,
      stationId: station.id
    }
    report.finishedAt = new Date().toISOString()
    report.audio.attempted = plan.records.length
    report.audio.failed = plan.records.filter((record) => record.audioStatus !== 'ready').length
    await mkdir(path.dirname(reportPath), { recursive: true })
    await writeFile(reportPath, JSON.stringify(report, null, 2))
    await writeFile(statePath, JSON.stringify({ ...plan, records: plan.records.map((record) => ({ ...record, filePath: record.filePath })) }, null, 2))
    console.log(JSON.stringify({ success: true, reportPath, statePath, database: report.database, audio: report.audio, metadata: report.metadata }, null, 2))
  } finally {
    if (db) await db.end().catch(() => {})
    s3.destroy()
  }
}

const main = async () => {
  const info = await stat(sourceRoot)
  if (!info.isDirectory()) throw new Error(`--source não é um diretório: ${sourceRoot}`)
  const plan = await scanLibrary()
  await mkdir(path.dirname(statePath), { recursive: true })
  await writeFile(statePath, JSON.stringify({ ...plan, records: plan.records.map((record) => ({ ...record, filePath: record.filePath })) }, null, 2))
  printSummary(plan)
  if (!execute) {
    console.error(`Inventário salvo em ${statePath}. Use --execute para enviar os arquivos e importar o catálogo.`)
    return
  }
  if (!stationIdArg) console.error('Nenhum --station-id informado; será usada a estação radio-indoor da conta.')
  await executePlan(plan)
}

main().catch((error) => {
  console.error(`[radio-import] ${error?.stack || error?.message || error}`)
  process.exitCode = 1
})
