import { execFile as execFileCallback } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

// Mantém a capa no mesmo ponto inicial que a biblioteca já mostrava ao buscar o MP4.
export const VIDEO_COVER_FRAME_SECONDS = .45
export const VIDEO_COVER_FILTER = 'scale=960:540:force_original_aspect_ratio=decrease:force_divisible_by=2'

export const videoCoverArgs = (source, output) => [
  '-hide_banner',
  '-loglevel', 'error',
  '-y',
  '-ss', String(VIDEO_COVER_FRAME_SECONDS),
  '-i', source,
  '-frames:v', '1',
  '-vf', VIDEO_COVER_FILTER,
  '-an',
  '-c:v', 'mjpeg',
  '-q:v', '4',
  output,
]

/** Extrai uma capa pequena do render concluído, sem reabrir a composição Remotion. */
export async function createVideoCover(source, output) {
  await execFile('ffmpeg', videoCoverArgs(source, output), { timeout: 20_000, maxBuffer: 256 * 1024 })
  const bytes = await readFile(output)
  if (!bytes.length) throw Error('Não foi possível gerar a capa do vídeo.')
  return bytes
}
