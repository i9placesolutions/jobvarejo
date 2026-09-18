import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * MusicGPT TTS clona melhor com 10–20s de fala limpa (mono, sem música).
 * Pulamos 1s inicial (cliques/silêncio) e normalizamos loudness.
 */
export const MUSICGPT_VOICE_CLIP_SECONDS = 18
export const MUSICGPT_VOICE_CLIP_START_SECONDS = 1

export interface MusicGptVoiceClipResult {
  buffer: Buffer
  durationSec: number
  startSec: number
}

/**
 * Recodifica um trecho válido mono mp3 otimizado para clonagem.
 * Corte cru em bytes quebra frames e o MusicGPT tende a gerar voz genérica.
 */
export const buildMusicGptVoiceClip = async (
  source: Buffer,
  options?: { startSec?: number; durationSec?: number }
): Promise<MusicGptVoiceClipResult | null> => {
  if (!source?.length) return null
  const startSec = Math.max(0, Number(options?.startSec ?? MUSICGPT_VOICE_CLIP_START_SECONDS) || 0)
  const durationSec = Math.min(
    30,
    Math.max(8, Number(options?.durationSec ?? MUSICGPT_VOICE_CLIP_SECONDS) || MUSICGPT_VOICE_CLIP_SECONDS)
  )
  const dir = await mkdtemp(join(tmpdir(), 'mgpt-voice-'))
  const inputPath = join(dir, 'source.bin')
  const outputPath = join(dir, 'clip.mp3')
  try {
    await writeFile(inputPath, source)
    const ok = await runFfmpeg([
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-ss', String(startSec),
      '-t', String(durationSec),
      '-i', inputPath,
      '-vn',
      '-ac', '1',
      '-ar', '44100',
      // Foco em voz falada + loudness estável para o modelo de clone.
      '-af', 'highpass=f=80,lowpass=f=8500,loudnorm=I=-16:TP=-1.5:LRA=11',
      '-b:a', '192k',
      '-f', 'mp3',
      outputPath
    ])
    if (!ok) return null
    const buffer = await readFile(outputPath)
    if (buffer.length < 12_000) return null
    return { buffer, durationSec, startSec }
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
    }, 45_000)
    child.on('error', () => {
      clearTimeout(timer)
      finish(false)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      finish(code === 0)
    })
  })
