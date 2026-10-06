// Worker thread do desenho das prévias do catálogo (ver server/utils/catalog-preview-pool.ts).
// Empacotado no build com esbuild em render-worker.mjs; fabric, canvas, jsdom e sharp ficam externos
// e vêm do node_modules do runtime.
import { parentPort } from 'node:worker_threads'
import { drawCatalogPreview, type CatalogPreviewDrawInput } from '../../server/utils/catalog-preview-draw'

if (!parentPort) throw new Error('render-worker precisa rodar como worker thread.')
const port = parentPort

port.on('message', async (message: { id: number; input: CatalogPreviewDrawInput }) => {
  try {
    const bytes = await drawCatalogPreview(message.input)
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    port.postMessage({ id: message.id, ok: true, bytes: copy }, [copy.buffer])
  } catch (error: any) {
    port.postMessage({ id: message.id, ok: false, error: String(error?.message || error) })
  }
})
