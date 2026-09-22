import catalog from '~/shared/video-studio/generated-flyer-recipes.json'
import { cartazistaUser } from '~/server/utils/cartazista'

// Reutiliza somente os assets públicos dos encartes já cadastrados.
// Não instancia o editor de vídeos nem modifica os projetos de origem.
export default defineEventHandler(async event => {
  await cartazistaUser(event)
  return { headers: catalog.filter(item => item.seal).map(item => ({
    id: item.sourceProject,
    name: item.name,
    background: item.background ? `/video-studio/templates/${item.background}` : '',
    seal: `/video-studio/templates/${item.seal}`,
    color: item.base,
    ...('mascot' in item && item.mascot ? {mascot: `/video-studio/templates/${item.mascot}`} : {}),
    ...('posterLayout' in item ? {layout: item.posterLayout} : {})
  })) }
})
