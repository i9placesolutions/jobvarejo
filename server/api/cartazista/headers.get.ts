import headerAssets from '~/shared/cartazista/header-assets.json'
import catalog from '~/shared/video-studio/generated-flyer-recipes.json'
import { cartazistaUser } from '~/server/utils/cartazista'
import type { RetailReferenceArtwork } from '~/shared/retail-reference-artwork'

const campaignAssets: Record<string, { background: string; seal: string; backgroundCropY?: number }> = headerAssets
type ReferenceCatalogItem = { id?: string; sourceProject: string; name: string; seal?: string; background?: string; base: string; accent?: string; ink?: string; mascot?: string; posterRetailFinish?: unknown; posterTagline?: string; posterPriceCornerRadius?: number; posterLayout?: 'suina-ouro'|'suina-rustica'|'thematic-seal'; referenceArtwork?: RetailReferenceArtwork }
const referenceCatalog = catalog as unknown as ReferenceCatalogItem[]

// Reutiliza somente os assets públicos dos encartes já cadastrados.
// Não instancia o editor de vídeos nem modifica os projetos de origem.
export default defineEventHandler(async event => {
  await cartazistaUser(event)
  return { headers: referenceCatalog.filter(item => item.seal || item.referenceArtwork).map(item => {
    const sourceIndex = referenceCatalog.indexOf(item)
    const referenceArtwork = item.referenceArtwork && {
      ...item.referenceArtwork,
      src: item.referenceArtwork.src.startsWith('/') || item.referenceArtwork.src.startsWith('http')
        ? item.referenceArtwork.src
        : `/video-studio/templates/${item.referenceArtwork.src}`,
      sourceIndex: Number.isInteger(item.referenceArtwork.sourceIndex)
        ? item.referenceArtwork.sourceIndex
        : sourceIndex
    }
    return ({
    id: item.sourceProject,
    name: item.name,
    background: campaignAssets[item.sourceProject]?.background ?? (item.background ? `/video-studio/templates/${item.background}` : ''),
    backgroundCropY: campaignAssets[item.sourceProject]?.backgroundCropY,
    seal: campaignAssets[item.sourceProject]?.seal ?? (item.seal ? `/video-studio/templates/${item.seal}` : referenceArtwork?.src ?? ''),
    ...(referenceArtwork ? { referenceArtwork } : {}),
    color: item.base,
    accent: item.accent,
    secondary: item.ink,
    ...('posterRetailFinish' in item ? {retailFinish: item.posterRetailFinish} : {}),
    ...('posterTagline' in item ? {tagline: item.posterTagline} : {}),
    ...('posterPriceCornerRadius' in item ? {priceCornerRadius: item.posterPriceCornerRadius} : {}),
    ...('mascot' in item && item.mascot ? {mascot: `/video-studio/templates/${item.mascot}`} : {}),
    ...('posterLayout' in item ? {layout: item.posterLayout} : {})
  })}) }
})
