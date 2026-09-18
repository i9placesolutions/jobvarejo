import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Trecho curto e limpo para clonagem zero-shot (~10–15s). */
export const MUSICGPT_VOICE_CLIP_SECONDS = 12

/**
 * Recodifica um trecho válido (mono mp3) em vez de cortar bytes crus —
 * corte bruto quebra frames e o MusicGPT tende a ignorar a amostra.
 */
export const buildMusicGptVoiceClip = async (source: Buffer): Promise<Buffer | null> => {
  if (!source?.length) return null
  const dir = await mkdtemp(join(tmpdir(), 'mgpt-voice-'))
  const inputPath = join(dir, 'source.bin')
  const outputPath = join(dir, 'clip.mp3')
  try {
    await writeFile(inputPath, source)
    const ok = await runFfmpeg([
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-t', String(MUSICGPT_VOICE_CLIP_SECONDS),
      '-vn',
      '-ac', '1',
      '-ar', '44100',
      '-b:a', '128k',
      '-f', 'mp3',
      outputPath
    ])
    if (!ok) return null
    const clip = await readFile(outputPath)
    return clip.length > 8_000 ? clip : null
  } catch {
    return null
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

const runFfmpeg = (args: string[]): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(false)
    }, 25_000)
    child.on('error', () => {
      clearTimeout(timer)
      finish(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish(code === 0)
    })
  })
