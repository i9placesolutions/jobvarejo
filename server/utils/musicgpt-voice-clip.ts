import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Clip só de fala para o MusicGPT clonar a voz.
 * Trilha/música da amostra é atenuada (mid + banda de voz) —
 * a trilha do produto final deve ser gerada pelo MusicAI, não herdada.
 */
export const MUSICGPT_VOICE_CLIP_SECONDS = 18
export const MUSICGPT_VOICE_CLIP_START_SECONDS = 1

export interface MusicGptVoiceClipResult {
  buffer: Buffer
  durationSec: number
  startSec: number
  mode: 'voice-isolate'
}

/**
 * Isola fala (canal mid + banda vocal + denoise) e normaliza loudness.
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
    // 1) tenta isolamento completo (afftdn pode faltar em builds mínimos)
    // 2) fallback sem denoise
    const attempts = [
      'pan=mono|c0=0.5*c0+0.5*c1,highpass=f=120,lowpass=f=6500,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11',
      'pan=mono|c0=0.5*c0+0.5*c1,highpass=f=120,lowpass=f=6500,loudnorm=I=-16:TP=-1.5:LRA=11'
    ]
    for (const af of attempts) {
      const ok = await runFfmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-ss', String(startSec),
        '-t', String(durationSec),
        '-i', inputPath,
        '-vn',
        '-af', af,
        '-ar', '44100',
        '-b:a', '192k',
        '-f', 'mp3',
        outputPath
      ])
      if (!ok) continue
      const buffer = await readFile(outputPath)
      if (buffer.length < 12_000) continue
      return { buffer, durationSec, startSec, mode: 'voice-isolate' }
    }
    return null
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
