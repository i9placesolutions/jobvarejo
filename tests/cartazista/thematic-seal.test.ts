import {describe,it,expect} from 'vitest'
import {createCartazistaDocument,rebuildCartazistaComposition} from '../../utils/cartazista/composition'
import {hydrateCartazistaBusiness} from '../../utils/cartazista/business-bindings'
import {cartazistaDocumentSchema} from '../../utils/cartazista/schema'
import {CARTAZISTA_FORMATS} from '../../types/cartazista'
describe('Campanha com selo e personagem integrados',()=>{
 for(const format of CARTAZISTA_FORMATS)it(format.id+' preserva selo, logo independente e paleta',()=>{
  const d=createCartazistaDocument({themeId:'suina-rustica',formatId:format.id,modelId:format.id==='banner-2m'?'banner-2m':'standard'})
  d.settings.header={id:'00000000-0000-4000-8000-000000000001',name:'Quarta do Frango',background:'/video-studio/templates/bg.png',seal:'/video-studio/templates/seal.png',layout:'thematic-seal',color:'#411006',accent:'#ffce13',secondary:'#e2280d'}
  const result=rebuildCartazistaComposition(d),c=result.composition
  expect(cartazistaDocumentSchema.safeParse(result).success).toBe(true)
  expect(c.background).toBe('#411006')
  expect(c.layers.filter(l=>l.binding==='logo')).toHaveLength(1)
  expect(c.layers.some(l=>l.id==='cartaz-campaign-mascot')).toBe(false)
  expect(c.layers.find(l=>l.id==='cartaz-price-brush')?.fill).toBe('#e2280d')
  for(const id of ['cartaz-campaign-seal','cartaz-logo','cartaz-logo-backdrop']){
   const l=c.layers.find(l=>l.id===id)!
   expect(l.x).toBeGreaterThanOrEqual(0);expect(l.y).toBeGreaterThanOrEqual(0)
   expect(l.x+l.width).toBeLessThanOrEqual(c.width);expect(l.y+l.height).toBeLessThanOrEqual(c.height)
  }
  if(format.id==='banner-2m'){
   const name=c.layers.find(l=>l.id==='cartaz-product-name')!
   const price=c.layers.find(l=>l.id==='cartaz-price-brush')!
   expect(name.x+name.width).toBeLessThan(price.x)
  }
  const profile={companyName:'Loja',whatsapp:'11999999999',address:'Rua A',instagram:'@loja'}
  const hydrated=hydrateCartazistaBusiness(c,profile,'/logo.png')
  expect(hydrated.layers.find(l=>l.id==='cartaz-logo-backdrop')?.visible).toBe(true)
  expect(hydrateCartazistaBusiness(hydrated,profile,'').layers.find(l=>l.id==='cartaz-logo-backdrop')?.visible).toBe(false)
 })
})
