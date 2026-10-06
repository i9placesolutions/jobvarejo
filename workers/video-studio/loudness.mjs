import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { rename, rm } from 'node:fs/promises'

const exec = promisify(execFile)
// Padrão de redes sociais (Reels/TikTok/YouTube): -14 LUFS integrado e pico real abaixo de -1 dBTP.
export const LOUDNESS_TARGET = { I: -14, TP: -1, LRA: 11 }

/** Lê o JSON do loudnorm impresso no stderr do ffmpeg. */
export function parseLoudnormJson(stderr) {
  const start = stderr.lastIndexOf('{'), end = stderr.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try { return JSON.parse(stderr.slice(start, end + 1)) } catch { return null }
}

/**
 * Normaliza o áudio final do MP4 em duas passadas (medição + aplicação), copiando o vídeo sem recodificar.
 * Um limitador vem depois do ganho: mixagens muito baixas precisam de muitos dB e estourariam o pico.
 * Mantém o arquivo original se não houver áudio, se o trecho for silêncio ou se o ffmpeg falhar.
 */
export async function normalizeLoudness(file, target = LOUDNESS_TARGET) {
  const filter = `loudnorm=I=${target.I}:TP=${target.TP}:LRA=${target.LRA}`
  let measured
  try {
    const { stderr } = await exec('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `${filter}:print_format=json`, '-f', 'null', '-'], { timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
    measured = parseLoudnormJson(stderr)
  } catch (error) {
    console.warn('[video-studio] Medição de loudness falhou; mantendo o áudio original:', error?.message)
    return { normalized: false, reason: 'measure-failed' }
  }
  if (!measured || !Number.isFinite(Number(measured.input_i)) || Number(measured.input_i) < -70) return { normalized: false, reason: 'no-audio' }
  const tmp = file.replace(/\.mp4$/i, '') + '.loudnorm.mp4'
  try {
    await exec('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', file, '-map', '0', '-c:v', 'copy',
      '-af', `${filter}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true,alimiter=limit=${Math.pow(10, (target.TP - .5) / 20).toFixed(3)}:level=false`,
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', tmp], { timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
    await rename(tmp, file)
    return { normalized: true, inputI: Number(measured.input_i), target: target.I }
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {})
    console.warn('[video-studio] Normalização de loudness falhou; mantendo o áudio original:', error?.message)
    return { normalized: false, reason: 'apply-failed' }
  }
}
