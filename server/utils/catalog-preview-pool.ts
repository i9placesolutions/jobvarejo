import { fork, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { drawCatalogPreview, type CatalogPreviewDrawInput } from './catalog-preview-draw'

// Pool de processos filhos para o desenho nativo das prévias. Sem ele, cada prévia travava o
// processo inteiro por segundos (login lento, healthcheck falhando e 502 no proxy) — em especial
// no aquecimento da biblioteca depois de muitos modelos serem atualizados de uma vez.
// Processo e não worker thread: o node-canvas (fontconfig/pango) não é seguro entre threads do
// mesmo processo — em produção os desenhos travavam até o tempo limite sem nenhum erro. Cada
// processo filho tem o próprio canvas e as próprias fontes.
// O worker é empacotado no build da imagem (Dockerfile); sem o arquivo (dev/testes) o desenho
// acontece no próprio processo, como antes. CATALOG_PREVIEW_WORKER=0 força o modo antigo.

const WORKER_FILE = resolve(process.cwd(), 'workers/catalog-preview/render-worker.mjs')
const JOB_TIMEOUT_MS = Math.max(15_000, Math.trunc(Number(process.env.CATALOG_PREVIEW_WORKER_TIMEOUT_MS) || 90_000))
const POOL_SIZE = Math.min(4, Math.max(1, Math.trunc(Number(process.env.CATALOG_PREVIEW_CONCURRENCY) || 2)))

type Job = { id: number; input: CatalogPreviewDrawInput; resolve: (bytes: Buffer) => void; reject: (error: Error) => void }
type Slot = { child: ChildProcess; job: Job | null; timer: ReturnType<typeof setTimeout> | null }
type WorkerReply = { id: number; ok: boolean; bytes?: Uint8Array; error?: string }

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

// Processo com problema (erro, saída inesperada ou desenho travado) é encerrado e substituído.
const replace = (slot: Slot, error: Error) => {
  const index = slots.indexOf(slot)
  if (index >= 0) slots.splice(index, 1)
  slot.child.removeAllListeners()
  if (slot.child.exitCode === null && !slot.child.killed) slot.child.kill('SIGKILL')
  finish(slot, { error })
}

const spawn = (): Slot => {
  // serialization advanced: o WebP volta como Uint8Array, sem base64 no meio.
  const child = fork(WORKER_FILE, [], { serialization: 'advanced', stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
  const slot: Slot = { child, job: null, timer: null }
  child.on('message', (message: WorkerReply) => {
    if (!slot.job || message?.id !== slot.job.id) return
    finish(slot, message.ok && message.bytes
      ? { bytes: Buffer.from(message.bytes.buffer, message.bytes.byteOffset, message.bytes.byteLength) }
      : { error: new Error(message.error || 'Falha no desenho da prévia.') })
  })
  child.on('error', error => replace(slot, error instanceof Error ? error : new Error(String(error))))
  child.on('exit', (code, signal) => { if (slots.includes(slot)) replace(slot, new Error(`Processo de prévia encerrou (${signal || `código ${code}`}).`)) })
  // Processo ocioso não segura o servidor aberto no desligamento.
  child.unref()
  ;(child as ChildProcess & { channel?: { unref?: () => void } }).channel?.unref?.()
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
    slot.child.send({ id: job.id, input: job.input }, error => { if (error && slot.job === job) replace(slot, error) })
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
