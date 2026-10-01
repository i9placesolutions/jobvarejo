import headerAssets from '~/shared/cartazista/header-assets.json'
import catalog from '~/shared/video-studio/generated-flyer-recipes.json'
import { cartazistaUser } from '~/server/utils/cartazista'

const campaignAssets: Record<string, { background: string; seal: string; backgroundCropY?: number }> = headerAssets

// Reutiliza somente os assets públicos dos encartes já cadastrados.
// Não instancia o editor de vídeos nem modifica os projetos de origem.
export default defineEventHandler(async event => {
  await cartazistaUser(event)
  return { headers: catalog.filter(item => item.seal).map(item => ({
    id: item.sourceProject,
    name: item.name,
    background: campaignAssets[item.sourceProject]?.background ?? (item.background ? `/video-studio/templates/${item.background}` : ''),
    backgroundCropY: campaignAssets[item.sourceProject]?.backgroundCropY,
    seal: campaignAssets[item.sourceProject]?.seal ?? `/video-studio/templates/${item.seal}`,
    color: item.base,
    accent: item.accent,
    secondary: item.ink,
    ...('posterRetailFinish' in item ? {retailFinish: item.posterRetailFinish} : {}),
    ...('posterTagline' in item ? {tagline: item.posterTagline} : {}),
    ...('posterPriceCornerRadius' in item ? {priceCornerRadius: item.posterPriceCornerRadius} : {}),
    ...('mascot' in item && item.mascot ? {mascot: `/video-studio/templates/${item.mascot}`} : {}),
    ...('posterLayout' in item ? {layout: item.posterLayout} : {})
  })) }
})
