import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import type { GoogleCseImageCandidate } from './product-image-google-cse'

let active = 0
const waiting: Array<() => void> = []
const acquire = async () => {
  if (active < 2) { active++; return }
  await new Promise<void>(resolve => waiting.push(resolve))
}
const release = () => {
  const next = waiting.shift()
  if (next) next()
  else active--
}
export const searchChromiumImageCandidates = async (query: string): Promise<{ candidates: GoogleCseImageCandidate[]; error?: { message: string } }> => {
  await acquire()
  try {
    const stdout = await new Promise<string>((resolveOutput, reject) => {
      execFile(process.env.PRODUCT_IMAGE_PYTHON || 'python3', [resolve(process.cwd(), 'workers/chromium_image_search.py'), query],
        { timeout: 60000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => error && !stdout.trim() ? reject(error) : resolveOutput(stdout))
    })
    const result = JSON.parse(stdout)
    return { candidates: Array.isArray(result.candidates) ? result.candidates : [], ...(result.error ? { error: { message: result.error } } : {}) }
  } catch {
    return { candidates: [], error: { message: 'Não foi possível consultar imagens pelo Chromium.' } }
  } finally { release() }
}
