import {describe,it,expect} from 'vitest'
import {newVideoFromTemplate,applyVideoTemplate} from '../../shared/video-studio/templates'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {flyerRecipe} from '../../shared/video-studio/flyer-recipes'
import {resolveVideoLabel,type VideoLabel} from '../../shared/video-studio/labels'

describe('Modelos reutilizáveis de vídeo',()=>{
 it('começa sem marca, ofertas, data fictícia ou locução de outra conta',()=>{
  const doc=newVideoFromTemplate()
  expect(doc.brand.logo).toBe('');expect(doc.brand.name).toBe('')
  expect(doc.offers).toEqual([]);expect(doc.scripts).toEqual([]);expect(doc.validity).toBe('')
  expect(doc.voice.enabled).toBe(false);expect(doc.voice.id).toBe('default')
  expect(doc.motion?.product).toBe('slam');expect(doc.transition).toBe('snap-zoom')
  expect(videoDocumentSchema.safeParse(doc).success).toBe(true)
 })
 it('mantém instâncias independentes e preserva os dados do usuário ao trocar estilo',()=>{
  const a=newVideoFromTemplate(),b=newVideoFromTemplate()
  a.brand.name='Loja A';a.motion!.atmosphere.push('grid');a.voice={enabled:true,id:'voz-da-conta',pronunciations:[]}
  expect(b.brand.name).toBe('');expect(b.motion!.atmosphere).not.toContain('grid')
  applyVideoTemplate(a,'impact')
  expect(a.brand.name).toBe('Loja A');expect(a.voice.id).toBe('voz-da-conta');expect(a.voice.enabled).toBe(true)
 })
 it('carrega defaults visuais das 12 novas receitas sem substituir personalização manual',()=>{
  const ids=[
   'flyer-4ac789c8-71f4-4a8b-96ae-8d9e703f0282','flyer-f6dcbbe6-f9b1-4d09-8e21-31fe305cbbe5',
   'flyer-1a014da8-d0f0-483b-b56c-cf8f3a49a40b','flyer-1c9b7763-fa63-436b-9f2d-dfe1875ed04d',
   'flyer-78be56e6-beee-4095-adcb-871ef579c199','flyer-15edbe91-acc8-4d49-9f0e-e61992c07421',
   'flyer-4a578d49-087d-4922-a9f6-9f2376c099cc','flyer-d840b59b-6b17-4897-a7c3-9c312c756e4d',
   'flyer-e6b1d002-8bc2-4d6c-9678-6840f7f169a3','flyer-76386259-0a88-439e-b20e-b658acdff2a8',
   'flyer-d90ab0ad-ac4b-40db-8fea-f4bc77801480','flyer-df643073-16d3-4c30-9417-883bb287ff7c'
  ]
  for(const id of ids){
   const recipe=flyerRecipe(id)!,doc=newVideoFromTemplate(id)
   expect(doc.campaign).toBe(recipe.campaign)
   expect(resolveVideoLabel([{id:'account-label',name:recipe.labelNames[0]!}] as VideoLabel[],id)?.id).toBe('account-label')
   const [x,y,w,h]=recipe.horizontal.condition
   expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(recipe.horizontal.price[1]+recipe.horizontal.price[3])
   expect(x+w).toBeLessThanOrEqual(1920);expect(y+h).toBeLessThanOrEqual(1080)
   expect(doc.appearance?.contactColor).toBe('#ffffff')
  }
  const doc=newVideoFromTemplate(ids[2]!)
  doc.appearance={contactColor:'#bada55',textColor:'#cc00cc'}
  applyVideoTemplate(doc,ids[2]!)
  expect(doc.appearance).toEqual({contactColor:'#bada55',textColor:'#cc00cc'})
 })
})
