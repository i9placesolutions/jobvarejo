import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { speechReadinessIssue } from '../../../shared/video-studio/speech-readiness.mjs'

export async function normalizeVideoSpeech(scripts: Array<{ id: string; text: string }>, pronunciations: Array<{ from: string; to: string }>) {
  return new Promise<Array<{ id: string; text: string }>>((resolveResult, reject) => {
    const child = spawn(process.env.VIDEO_STUDIO_PYTHON || 'python3', [resolve('workers/video-studio/normalize.py')], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let settled = false
    const done = (error?: Error, value?: Array<{ id: string; text: string }>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      error ? reject(error) : resolveResult(value || [])
    }
    const timer = setTimeout(() => { child.kill(); done(Error('A preparação da fala demorou demais.')) }, 10_000)
    child.stdout.on('data', chunk => { output += String(chunk); if (output.length > 64_000) { child.kill(); done(Error('Resposta de locução inválida.')) } })
    child.stderr.resume()
    child.on('error', () => done(Error('O preparador de locução está indisponível.')))
    child.on('close', code => {
      if (settled) return
      if (code !== 0) return done(Error('Não foi possível preparar a fala. Confira datas e pronúncias.'))
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
