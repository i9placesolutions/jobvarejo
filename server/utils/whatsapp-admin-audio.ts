import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
/** MediaRecorder no Chrome produz WebM; WhatsApp PTT usa OGG/Opus. Nunca baixa URL externa. */
export const normalizeWhatsAppVoice = async (body: Record<string, any>) => {
  if (body.type !== 'ptt' || typeof body.file !== 'string') return body
  const match = /^data:audio\/(webm|mp4|wav)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(body.file)
  if (!match) return body
  const bytes = Buffer.from(match[2]!, 'base64')
  if (bytes.length > 12 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Áudio acima do limite de 12 MB.' })
  const directory = await mkdtemp(join(tmpdir(), 'jobvarejo-whatsapp-voice-'))
  try {
    const input = join(directory, `input.${match[1]}`)
    const output = join(directory, 'voice.ogg')
    await writeFile(input, bytes, { mode: 0o600 })
    await execute('ffmpeg', ['-nostdin', '-v', 'error', '-i', input, '-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', output], { timeout: 20_000, maxBuffer: 64 * 1024 })
    const converted = await readFile(output)
    if (converted.length > 12 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Áudio convertido acima do limite de 12 MB.' })
    return { ...body, file: `data:audio/ogg;base64,${converted.toString('base64')}`, mimetype: 'audio/ogg', docName: 'audio.ogg' }
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 422, statusMessage: 'Não foi possível preparar o áudio para WhatsApp. Verifique o arquivo e o FFmpeg do servidor.' })
  } finally { await rm(directory, { recursive: true, force: true }) }
}
