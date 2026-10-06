import { warmAllCatalogPreviews } from '../utils/project-catalog-preview'

// Depois de subir, gera as prévias que faltam na biblioteca para a galeria abrir com imagem.
// Em produção roda por padrão; em dev só com CATALOG_PREVIEW_WARM_ON_START=1.
const WARM_DELAY_MS = 20_000

export default defineNitroPlugin(() => {
  const flag = String(process.env.CATALOG_PREVIEW_WARM_ON_START || '').trim()
  const enabled = flag ? flag === '1' : !import.meta.dev
  if (!enabled) return
  const timer = setTimeout(() => {
    warmAllCatalogPreviews().catch((error: any) => {
      console.warn('[catalog-preview] Warm na inicialização falhou:', String(error?.message || error))
    })
  }, WARM_DELAY_MS)
  timer.unref?.()
})
