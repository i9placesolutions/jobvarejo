import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { drawCatalogPreview, type CatalogPreviewDrawInput } from './catalog-preview-draw'

// Pool de worker threads para o desenho nativo das prévias. Sem ele, cada prévia travava o
// processo inteiro por segundos (login lento, healthcheck falhando e 502 no proxy) — em especial
// no aquecimento da biblioteca depois de muitos modelos serem atualizados de uma vez.
// O worker é empacotado no build da imagem (Dockerfile); sem o arquivo (dev/testes) o desenho
// acontece no próprio processo, como antes. CATALOG_PREVIEW_WORKER=0 força o modo antigo.

const WORKER_FILE = resolve(process.cwd(), 'workers/catalog-preview/render-worker.mjs')
const JOB_TIMEOUT_MS = Math.max(15_000, Math.trunc(Number(process.env.CATALOG_PREVIEW_WORKER_TIMEOUT_MS) || 90_000))
const POOL_SIZE = Math.min(4, Math.max(1, Math.trunc(Number(process.env.CATALOG_PREVIEW_CONCURRENCY) || 2)))

type Job = { id: number; input: CatalogPreviewDrawInput; resolve: (bytes: Buffer) => void; reject: (error: Error) => void }
type Slot = { worker: Worker; job: Job | null; timer: ReturnType<typeof setTimeout> | null }

const slots: Slot[] = []
const waiting: Job[] = []
let nextId = 1

export const catalogPreviewWorkerEnabled = (): boolean =>
  String(process.env.CATALOG_PREVIEW_WORKER ?? '1').trim() !== '0' && existsSync(WORKER_FILE)

const finish = (slot: Slot, outcome: { bytes?: Buffer; error?: Error }) => {
  const job = slot.job
  if (slot.timer) clearTimeout(slot.timer)
  slot.job = null
  slot.timer = null
  if (job) outcome.error ? job.reject(outcome.error) : job.resolve(outcome.bytes!)
  pump()
}

// Worker com problema (erro fatal ou desenho travado) é descartado e substituído.
const replace = (slot: Slot, error: Error) => {
  const index = slots.indexOf(slot)
  if (index >= 0) slots.splice(index, 1)
  slot.worker.removeAllListeners()
  void slot.worker.terminate().catch(() => undefined)
  finish(slot, { error })
}

const spawn = (): Slot => {
  const worker = new Worker(WORKER_FILE)
  const slot: Slot = { worker, job: null, timer: null }
  worker.on('message', (message: { id: number; ok: boolean; bytes?: Uint8Array; error?: string }) => {
    if (!slot.job || message.id !== slot.job.id) return
    finish(slot, message.ok && message.bytes
      ? { bytes: Buffer.from(message.bytes.buffer, message.bytes.byteOffset, message.bytes.byteLength) }
      : { error: new Error(message.error || 'Falha no desenho da prévia.') })
  })
  worker.on('error', error => replace(slot, error instanceof Error ? error : new Error(String(error))))
  worker.on('exit', code => { if (slots.includes(slot)) replace(slot, new Error(`Worker de prévia encerrou (código ${code}).`)) })
  // Worker ocioso não segura o processo aberto no desligamento.
  worker.unref()
  slots.push(slot)
  return slot
}

const pump = () => {
  while (waiting.length) {
    const slot = slots.find(s => !s.job) || (slots.length < POOL_SIZE ? spawn() : null)
    if (!slot) return
    const job = waiting.shift()!
    slot.job = job
    slot.timer = setTimeout(() => replace(slot, new Error('Desenho da prévia excedeu o tempo limite.')), JOB_TIMEOUT_MS)
    slot.worker.postMessage({ id: job.id, input: job.input })
  }
}

/** Desenha fora do processo principal quando o worker existe; senão, no próprio processo. */
export const drawCatalogPreviewIsolated = (input: CatalogPreviewDrawInput): Promise<Buffer> => {
  if (!catalogPreviewWorkerEnabled()) return drawCatalogPreview(input)
  return new Promise<Buffer>((resolveJob, rejectJob) => {
    waiting.push({ id: nextId++, input, resolve: resolveJob, reject: rejectJob })
    pump()
  })
}
