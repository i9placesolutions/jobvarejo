// Processo filho do desenho das prévias do catálogo (ver server/utils/catalog-preview-pool.ts).
// Empacotado no build com esbuild em render-worker.mjs; fabric, canvas, jsdom e sharp ficam externos
// e vêm do node_modules do runtime. Um desenho por vez: o canvas nativo nunca é usado em paralelo.
import { drawCatalogPreview, type CatalogPreviewDrawInput } from '../../server/utils/catalog-preview-draw'

if (typeof process.send !== 'function') throw new Error('render-worker precisa rodar como processo filho (fork).')
const send = process.send.bind(process)

process.on('message', async (message: { id: number; input: CatalogPreviewDrawInput }) => {
  try {
    const bytes = await drawCatalogPreview(message.input)
    send({ id: message.id, ok: true, bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) })
  } catch (error: any) {
    send({ id: message.id, ok: false, error: String(error?.message || error) })
  }
})
// Servidor saiu (deploy, reinício): o processo filho sai junto.
process.on('disconnect', () => process.exit(0))
