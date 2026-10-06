import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createError } from 'h3'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { pgOneOrNull } from '../postgres'
import { getS3Client } from '../s3'
import {
  getLegacyUserProjectPrefix,
  isLegacyProjectPageKey,
  isPublicStorageKey,
  isServerManagedStorageKey,
  isUserProjectKey,
  isValidStoragePath,
  normalizeStoragePath
} from '../storage-scope'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

const MAX_MEDIA_BYTES = 5 * 1024 * 1024
const MAX_PROVIDER_JSON_BYTES = 7 * 1024 * 1024
const MAX_AUDIO_SECONDS = 120
const MAX_PROCESS_OUTPUT_BYTES = 8 * 1024 * 1024
const directJid = /^(\+?\d+)@s\.whatsapp\.net$/i
const accountUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type SanitizedProviderMessage = {
  messageId: string
  phone: string
  text: string
  type: 'text' | 'image' | 'audio'
  timestamp: number | null
  replyId?: string
}

export type ProviderEventResult = SanitizedProviderMessage | { ignored: true }

type ProviderMessageEnvelope = Record<string, any>

const fail = (statusCode: number, statusMessage: string): never => {
  throw createError({ statusCode, statusMessage })
}

const safeSecretEqual = (received: unknown, expected: string): boolean => {
  const actualBuffer = Buffer.from(String(received ?? ''), 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

const providerConfiguration = (): { token: string; instanceId: string; instanceName: string } => {
  const token = String(process.env.JOBVAREJO_UAZAPI_INSTANCE_TOKEN || '').trim()
  const instanceId = String(process.env.JOBVAREJO_UAZAPI_INSTANCE_ID || '').trim()
  if (!token || !instanceId) fail(503, 'Integração WhatsApp indisponível.')
  return { token, instanceId, instanceName: String(process.env.JOBVAREJO_UAZAPI_INSTANCE_NAME || instanceId).trim() }
}

const normalizeDirectPhone = (value: unknown): string => {
  const jid = String(value ?? '').trim()
  const match = jid.match(directJid)
  const raw = match ? match[1] : jid.includes('@') ? '' : jid
  return normalizeBrazilWhatsApp(raw)
}

const normalizedMessageType = (value: unknown): SanitizedProviderMessage['type'] | null => {
  const type = String(value ?? '').trim().toLowerCase().replace(/[ _-]/g, '')
  if (['conversation', 'extendedtextmessage', 'text', 'chat', 'buttonsresponsemessage', 'listresponsemessage'].includes(type)) return 'text'
  if (['image', 'imagemessage', 'sticker', 'stickermessage'].includes(type)) return 'image'
  if (['audio', 'audiomessage', 'ptt', 'voicenote', 'voicemessage'].includes(type)) return 'audio'
  return null
}

/** Verify provider credentials before deciding whether a signed event is ignorable. */
export function authenticateCreationProvider(body: unknown): ProviderMessageEnvelope {
  const config = providerConfiguration()
  const envelope = body && typeof body === 'object' && !Array.isArray(body)
    ? body as ProviderMessageEnvelope
    : {}

  if (!safeSecretEqual(envelope.token, config.token)) fail(401, 'Evento WhatsApp não autenticado.')
  const receivedInstanceId = String(envelope.instanceId || envelope.instanceID || '').trim()
  if (receivedInstanceId ? receivedInstanceId !== config.instanceId : String(envelope.instanceName || '').trim() !== config.instanceName) fail(401, 'Instância WhatsApp não autorizada.')
  return envelope
}

export function validateProviderEvent(body: unknown): ProviderEventResult {
  const envelope = authenticateCreationProvider(body)

  const eventType = String(envelope.EventType || envelope.event || '').trim().toLowerCase()
  if (eventType !== 'messages') return { ignored: true }
  const message = envelope.message && typeof envelope.message === 'object' && !Array.isArray(envelope.message)
    ? envelope.message as ProviderMessageEnvelope
    : {}
  const chatId = String(message.chatid || envelope.chat?.wa_chatid || '').trim()
  const messageId = String(message.messageid || message.id || '').trim()
  const type = normalizedMessageType(message.messageType)

  // Group/channel/history events must never be treated as a direct customer conversation.
  if (message.fromMe === true || message.isGroup === true || envelope.chat?.wa_isGroup === true ||
      /@(?:g\.us|newsletter|broadcast)$/i.test(chatId) || !type || !messageId) {
    return { ignored: true }
  }

  const phone = normalizeDirectPhone(message.sender_pn) || normalizeDirectPhone(chatId)
  if (!phone) return { ignored: true }

  const timestampRaw = Number(message.messageTimestamp)
  const timestamp = Number.isSafeInteger(timestampRaw) && timestampRaw > 0 ? timestampRaw : null
  const rawText = typeof message.text === 'string'
    ? message.text
    : typeof message.content?.text === 'string' ? message.content.text : ''
  const replyId = String(message.quoted || message.replyId || '').trim().slice(0, 200)

  return {
    messageId: messageId.slice(0, 200),
    phone,
    text: rawText.slice(0, 10_000),
    type,
    timestamp,
    ...(replyId ? { replyId } : {})
  }
}

const safeAccountId = (accountId: string): string => {
  const normalized = String(accountId || '').trim()
  if (!accountUuid.test(normalized)) fail(400, 'Conta inválida.')
  return normalized
}

const isOwnWhatsAppKey = (key: string, accountId: string): boolean => key.startsWith(`whatsapp-creation/${accountId}/`)
const isOwnArtKey = (key: string, accountId: string): boolean => key.startsWith(`art-studio/${accountId}/`)
const isOwnVideoKey = (key: string, accountId: string): boolean => key.startsWith(`video-studio/${accountId}/`)
const isOwnProjectKey = (key: string, accountId: string): boolean =>
  isUserProjectKey(key, accountId) ||
  (isLegacyProjectPageKey(key) && key.startsWith(getLegacyUserProjectPrefix(accountId)))

const isAuthorizedTemplateKey = (key: string, authorizedKeys?: ReadonlySet<string>): boolean =>
  Boolean(authorizedKeys?.has(key))

const assertSafeKey = (key: string): string => {
  const normalized = normalizeStoragePath(key)
  if (!normalized || !isValidStoragePath(normalized)) fail(403, 'Arquivo indisponível para esta conta.')
  return normalized
}

const isKnownProductImageKey = async (key: string): Promise<boolean> => {
  if (!key.startsWith('imagens/')) return false
  // Fotos de produto em imagens/ são gravadas com leitura pública. Uma foto já aprovada
  // continua válida mesmo depois que o cache do banco passa a apontar para outra imagem.
  if (isPublicStorageKey(key) && !isServerManagedStorageKey(key)) return true
  const row = await pgOneOrNull<{ s3_key: string }>(
    `select s3_key from public.product_image_cache
      where s3_key = $1 and image_url is not null
      limit 1`,
    [key]
  )
  return row?.s3_key === key
}

const canReadKey = async (key: string, accountId: string, authorizedKeys?: ReadonlySet<string>): Promise<boolean> => {
  if (isOwnWhatsAppKey(key, accountId) || isOwnProjectKey(key, accountId) || isOwnArtKey(key, accountId) || isOwnVideoKey(key, accountId)) return true
  if (isAuthorizedTemplateKey(key, authorizedKeys)) return true
  return await isKnownProductImageKey(key)
}

const storageBucket = (): string => {
  const config = useRuntimeConfig()
  return String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || '').trim()
}

export async function ownedStorageBytes(
  key: string,
  accountId: string,
  authorizedTemplateKeys?: ReadonlySet<string>
): Promise<Buffer> {
  const owner = safeAccountId(accountId)
  const normalizedKey = assertSafeKey(key)
  if (!await canReadKey(normalizedKey, owner, authorizedTemplateKeys)) fail(403, 'Arquivo indisponível para esta conta.')
  const bucket = storageBucket()
  if (!bucket) fail(503, 'Armazenamento indisponível.')
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: normalizedKey }))
  const body = response.Body
  if (!body) return fail(404, 'Arquivo não encontrado.')
  return Buffer.from(await body.transformToByteArray())
}

export async function signOwnedArtifact(
  key: string,
  accountId: string,
  authorizedTemplateKeys?: ReadonlySet<string>
): Promise<string> {
  const owner = safeAccountId(accountId)
  const normalizedKey = assertSafeKey(key)
  const isOwnArtifact = isOwnWhatsAppKey(normalizedKey, owner) || isOwnProjectKey(normalizedKey, owner) ||
    isOwnArtKey(normalizedKey, owner) || isOwnVideoKey(normalizedKey, owner)
  if (!isOwnArtifact && !isAuthorizedTemplateKey(normalizedKey, authorizedTemplateKeys) && !await isKnownProductImageKey(normalizedKey)) {
    return fail(403, 'Arquivo indisponível para esta conta.')
  }
  const bucket = storageBucket()
  if (!bucket) fail(503, 'Armazenamento indisponível.')
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: bucket, Key: normalizedKey }), { expiresIn: 900 })
}

const providerUrl = (): URL => {
  const raw = String(process.env.JOBVAREJO_UAZAPI_URL || '').trim()
  if (!raw) fail(503, 'Integração WhatsApp indisponível.')
  let base: URL
  try { base = new URL(raw) } catch { return fail(503, 'Integração WhatsApp indisponível.') }
  const explicitlyAllowedHost = String(process.env.JOBVAREJO_UAZAPI_ALLOWED_HOST || '').trim().toLowerCase()
  const knownHost = base.hostname === 'uazapi.com' || base.hostname.endsWith('.uazapi.com')
  const allowedCustomHost = explicitlyAllowedHost && base.hostname.toLowerCase() === explicitlyAllowedHost
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || (!knownHost && !allowedCustomHost)) {
    fail(503, 'Integração WhatsApp indisponível.')
  }
  return new URL(`${base.toString().replace(/\/$/, '')}/message/download`)
}

const readLimitedResponse = async (response: Response): Promise<string> => {
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_PROVIDER_JSON_BYTES) fail(413, 'Mídia acima do limite permitido.')
  const responseBody = response.body
  if (!responseBody) return fail(502, 'O provedor não retornou a mídia solicitada.')
  const reader = responseBody.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_PROVIDER_JSON_BYTES) {
        await reader.cancel().catch(() => {})
        fail(413, 'Mídia acima do limite permitido.')
      }
      chunks.push(value)
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    fail(502, 'Falha ao receber a mídia do provedor.')
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8')
}

const decodeBase64 = (value: unknown): Buffer => {
  const encoded = String(value ?? '').trim()
  if (!encoded || encoded.length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4 + 8 ||
      encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    fail(413, 'Mídia ausente, inválida ou acima do limite permitido.')
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  if ((encoded.includes('=') && padding === 0) || Math.floor(encoded.length * 3 / 4) - padding > MAX_MEDIA_BYTES) {
    fail(413, 'Mídia ausente, inválida ou acima do limite permitido.')
  }
  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.length > MAX_MEDIA_BYTES || bytes.toString('base64') !== encoded) {
    fail(413, 'Mídia ausente, inválida ou acima do limite permitido.')
  }
  return bytes
}

const providerMessageId = (value: unknown): string => {
  const id = String(value ?? '').trim()
  if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(id)) fail(400, 'Identificador de mensagem inválido.')
  return id
}

const putInbound = async (accountId: string, bytes: Buffer, mimeType: string, extension: string) => {
  const bucket = storageBucket()
  if (!bucket) fail(503, 'Armazenamento indisponível.')
  const key = `whatsapp-creation/${accountId}/inbound/${randomUUID()}.${extension}`
  await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType }))
  return key
}

const imageMimeFromSharpFormat = (format: string | undefined): { mimeType: string; extension: string } => {
  if (format === 'jpeg') return { mimeType: 'image/jpeg', extension: 'jpg' }
  if (format === 'png') return { mimeType: 'image/png', extension: 'png' }
  if (format === 'webp') return { mimeType: 'image/webp', extension: 'webp' }
  if (format === 'avif') return { mimeType: 'image/avif', extension: 'avif' }
  return fail(415, 'Formato de imagem não suportado.')
}

const handleImage = async (bytes: Buffer) => {
  const sharp = (await import('sharp')).default
  try {
    const image = sharp(bytes, { limitInputPixels: 24_000_000, animated: false, failOn: 'error' })
    const metadata = await image.metadata()
    const original = imageMimeFromSharpFormat(metadata.format)
    const pixels = Number(metadata.width || 0) * Number(metadata.height || 0)
    if (!metadata.width || !metadata.height || pixels > 24_000_000) fail(413, 'Imagem acima do limite permitido.')
    const normalized = await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .toFormat(metadata.hasAlpha ? 'png' : 'jpeg', metadata.hasAlpha ? undefined : { quality: 85, mozjpeg: true })
      .toBuffer()
    if (!normalized.length || normalized.length > MAX_MEDIA_BYTES) fail(413, 'Imagem normalizada acima do limite permitido.')
    return {
      originalMime: original.mimeType,
      extension: original.extension,
      visionMime: metadata.hasAlpha ? 'image/png' : 'image/jpeg',
      visionBytes: normalized
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    return fail(415, 'Imagem inválida ou não suportada.')
  }
}

type ProbeResult = { duration: number; codec: string; format: string }

const runCommand = (command: string, args: string[], input: Buffer, outputLimit = MAX_PROCESS_OUTPUT_BYTES): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true })
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const rejectSafe = () => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('media processing failed'))
    }
    child.on('error', rejectSafe)
    child.stdout.on('data', (chunk: Buffer | Uint8Array) => {
      size += chunk.byteLength
      if (size > outputLimit) return rejectSafe()
      chunks.push(Buffer.from(chunk))
    })
    child.on('close', (code: number | null) => {
      if (settled) return
      settled = true
      if (code !== 0) return reject(new Error('media processing failed'))
      resolve(Buffer.concat(chunks))
    })
    child.stdin.on('error', () => {})
    child.stdin.end(input)
  })

const probeAudio = async (bytes: Buffer): Promise<ProbeResult> => {
  const output = await runCommand('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration,format_name:stream=codec_name,codec_type,duration',
    '-of', 'json', 'pipe:0'
  ], bytes, 256 * 1024)
  let parsed: any
  try { parsed = JSON.parse(output.toString('utf8')) } catch { fail(415, 'Áudio inválido ou não suportado.') }
  const stream = Array.isArray(parsed?.streams) ? parsed.streams.find((item: any) => item?.codec_type === 'audio') : null
  const duration = Number(parsed?.format?.duration || stream?.duration || 0)
  const codec = String(stream?.codec_name || '').toLowerCase()
  const format = String(parsed?.format?.format_name || '').toLowerCase()
  if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > MAX_AUDIO_SECONDS) {
    fail(413, 'Áudio inválido ou acima de dois minutos.')
  }
  return { duration, codec, format }
}

const validateAudioMime = (mimeType: string): void => {
  if (!['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/opus'].includes(mimeType.toLowerCase())) {
    fail(415, 'Formato de áudio não suportado.')
  }
}

const handleAudio = async (bytes: Buffer, mimeType: string): Promise<{ storedBytes: Buffer; inputAudio: Buffer; storedMime: string; extension: string }> => {
  validateAudioMime(mimeType)
  const inputProbe = await probeAudio(bytes)
  const normalizedMime = mimeType.toLowerCase().split(';')[0]?.trim() || ''
  const declaredMp3 = ['audio/mpeg', 'audio/mp3'].includes(normalizedMime)
  const declaredWav = ['audio/wav', 'audio/x-wav', 'audio/wave'].includes(normalizedMime)
  const declaredOgg = ['audio/ogg', 'audio/opus'].includes(normalizedMime)
  const isWav = inputProbe.format.split(',').includes('wav') && inputProbe.codec.startsWith('pcm_')
  const isOgg = inputProbe.format.split(',').includes('ogg') && ['opus', 'vorbis'].includes(inputProbe.codec)
  if (declaredMp3 && inputProbe.codec !== 'mp3') fail(415, 'Áudio MP3 inválido.')
  if (declaredWav && !isWav) fail(415, 'Contêiner de áudio inválido ou não suportado.')
  if (declaredOgg && !isOgg) fail(415, 'Contêiner de áudio inválido ou não suportado.')
  if (inputProbe.codec === 'mp3') return { storedBytes: bytes, inputAudio: bytes, storedMime: 'audio/mpeg', extension: 'mp3' }
  if ((!isWav && !isOgg) || (declaredWav && !isWav) || (declaredOgg && !isOgg)) {
    fail(415, 'Contêiner de áudio inválido ou não suportado.')
  }

  // The provider's MP3 conversion can fail or return another format. Convert actual decoded audio;
  // never relabel WAV/OGG bytes as MP3.
  const converted = await runCommand('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-map', '0:a:0', '-vn',
    '-ac', '1', '-ar', '16000', '-b:a', '96k', '-f', 'mp3', 'pipe:1'
  ], bytes, MAX_MEDIA_BYTES)
  const convertedProbe = await probeAudio(converted)
  if (convertedProbe.codec !== 'mp3' || convertedProbe.duration > MAX_AUDIO_SECONDS) fail(415, 'Não foi possível validar o áudio convertido.')
  return { storedBytes: bytes, inputAudio: converted, storedMime: isWav ? 'audio/wav' : 'audio/ogg', extension: isWav ? 'wav' : 'ogg' }
}

const postProviderDownload = async (messageId: string): Promise<{ base64Data: string; mimeType: string }> => {
  const { token } = providerConfiguration()
  const response = await fetch(providerUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', token },
      body: JSON.stringify({ id: messageId, return_base64: true, generate_mp3: true, transcribe: false })
    }).catch(() => fail(502, 'Falha ao solicitar mídia ao provedor.'))
  if (!response.ok) fail(502, 'O provedor não disponibilizou a mídia solicitada.')
  let payload: any
  try { payload = JSON.parse(await readLimitedResponse(response)) } catch (error: any) {
    if (error?.statusCode) throw error
    fail(502, 'Resposta inválida do provedor de mídia.')
  }
  if (payload?.error || typeof payload?.base64Data !== 'string') fail(502, 'O provedor não retornou mídia em base64.')
  return { base64Data: payload.base64Data, mimeType: String(payload.mimetype || '').toLowerCase() }
}

export type ProviderMediaContent =
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: 'mp3' } }

export type DownloadedProviderMedia = {
  key: string
  hash: string
  mimeType: string
  content: ProviderMediaContent
}

export async function downloadProviderMedia(messageId: string, accountId: string): Promise<DownloadedProviderMedia> {
  const owner = safeAccountId(accountId)
  const id = providerMessageId(messageId)
  const downloaded = await postProviderDownload(id)
  const originalBytes = decodeBase64(downloaded.base64Data)
  const hash = createHash('sha256').update(originalBytes).digest('hex')

  if (downloaded.mimeType.startsWith('image/')) {
    const image = await handleImage(originalBytes)
    const key = await putInbound(owner, originalBytes, image.originalMime, image.extension)
    return {
      key,
      hash,
      mimeType: image.originalMime,
      content: { type: 'image_url', image_url: { url: `data:${image.visionMime};base64,${image.visionBytes.toString('base64')}` } }
    }
  }

  const audio = await handleAudio(originalBytes, downloaded.mimeType)
  const key = await putInbound(owner, audio.storedBytes, audio.storedMime, audio.extension)
  return {
    key,
    hash,
    mimeType: audio.storedMime,
    content: { type: 'input_audio', input_audio: { data: audio.inputAudio.toString('base64'), format: 'mp3' } }
  }
}
