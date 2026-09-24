import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { speechReadinessIssue } from '../../../shared/video-studio/speech-readiness.mjs'

type SpeechLine = { id: string; text: string }

const normalizerPath = resolve('workers/video-studio/normalize.py')
const unavailableCode = 'VIDEO_SPEECH_PYTHON_UNAVAILABLE'

export function videoSpeechPythonCandidates() {
  return [...new Set([
    String(process.env.VIDEO_STUDIO_PYTHON || '').trim(),
    '/opt/video-python/bin/python',
    String(process.env.PRODUCT_IMAGE_PYTHON || '').trim(),
    'python3'
  ].filter(Boolean))]
}

function unavailableError() {
  const error = Error('O preparador de locução está indisponível.') as Error & { code?: string }
  error.code = unavailableCode
  return error
}

function runNormalizer(python: string, scripts: SpeechLine[], pronunciations: Array<{ from: string; to: string }>) {
  return new Promise<Array<{ id: string; text: string }>>((resolveResult, reject) => {
    const child = spawn(python, [normalizerPath], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', stderr = ''
    let settled = false
    const done = (error?: Error, value?: SpeechLine[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      error ? reject(error) : resolveResult(value || [])
    }
    const timer = setTimeout(() => { child.kill(); done(Error('A preparação da fala demorou demais.')) }, 10_000)
    child.stdout.on('data', chunk => { output += String(chunk); if (output.length > 64_000) { child.kill(); done(Error('Resposta de locução inválida.')) } })
    child.stderr.on('data', chunk => { if (stderr.length < 8_000) stderr += String(chunk) })
    child.on('error', () => done(unavailableError()))
    child.on('close', code => {
      if (settled) return
      if (code !== 0) {
        if (/No module named ['\"]num2words['\"]/i.test(stderr) || /ModuleNotFoundError.*num2words/i.test(stderr)) return done(unavailableError())
        return done(Error('Não foi possível preparar a fala. Confira datas e pronúncias.'))
      }
      try {
        const value = JSON.parse(output)?.scripts
        if (!Array.isArray(value) || value.length !== scripts.length || value.some((line, i) => line.id !== scripts[i]?.id || typeof line.text !== 'string' || !line.text.trim())) throw Error()
        const issue = speechReadinessIssue(value)
        if (issue) return done(Error(issue))
        done(undefined, value)
      } catch (error) { done(error instanceof Error && error.message ? error : Error('Resposta de locução inválida.')) }
    })
    child.stdin.on('error', () => {})
    child.stdin.end(JSON.stringify({ scripts, pronunciations }))
  })
}

export async function normalizeVideoSpeech(scripts: SpeechLine[], pronunciations: Array<{ from: string; to: string }>) {
  const attempted: string[] = []
  for (const python of videoSpeechPythonCandidates()) {
    attempted.push(python)
    try {
      return await runNormalizer(python, scripts, pronunciations)
    } catch (error) {
      if ((error as Error & { code?: string })?.code !== unavailableCode) throw error
    }
  }
  console.error('[video-speech] Nenhum preparador Python disponível.', { attempted, configured: !!process.env.VIDEO_STUDIO_PYTHON })
  throw unavailableError()
}
