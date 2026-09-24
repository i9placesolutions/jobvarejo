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
  expect(c.background).toBe('#ffffff')
  expect(c.layers.filter(l=>l.binding==='logo')).toHaveLength(1)
  expect(c.layers.some(l=>l.id==='cartaz-campaign-mascot')).toBe(false)
  expect(c.layers.find(l=>l.id==='cartaz-price-brush')?.shape).toBe('path')
  expect(c.layers.find(l=>l.id==='cartaz-price')?.fontFamily).toBe('Knewave')
  expect(c.layers.find(l=>l.id==='cartaz-product-name')?.fontFamily).toBe('Knewave')
  expect(c.layers.some(l=>['phone','address','instagram'].includes(l.binding||''))).toBe(false)
  expect(c.layers.some(l=>l.id==='cartaz-campaign-scene')).toBe(false)
  for(const id of ['cartaz-campaign-seal','cartaz-logo']){
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
  expect(hydrated.layers.some(l=>l.id==='cartaz-logo-backdrop')).toBe(false)
  expect(hydrated.layers.find(l=>l.id==='cartaz-logo')?.src).toBe('/logo.png')
  expect(hydrateCartazistaBusiness(hydrated,profile,'').layers.find(l=>l.id==='cartaz-logo')?.visible).toBe(false)
 })
})

it('cabeçalho não altera o corpo, inclusive ofertas com dois preços', async()=>{
 const {CARTAZISTA_STARTER_MODELS}=await import('../../utils/cartazista/catalog')
 for(const model of CARTAZISTA_STARTER_MODELS){
  const doc=createCartazistaDocument({modelId:model.id})
  doc.products[0]!.price=12.90
  doc.products[0]!.secondPrice=9.90
  const before=rebuildCartazistaComposition(doc).composition
  doc.settings.header={id:'00000000-0000-4000-8000-000000000001',name:'Campanha',background:'',seal:'/api/storage/p?key=projects%2Fseal.png',color:'#112233',layout:'thematic-seal'}
  const after=rebuildCartazistaComposition(doc)
  expect(cartazistaDocumentSchema.safeParse(after).success).toBe(true)
  const body=(c:typeof before)=>c.layers.filter(l=>!l.id.startsWith('cartaz-campaign-')&&!['cartaz-logo','cartaz-header-brush','cartaz-offer-label'].includes(l.id))
  expect(body(after.composition)).toEqual(body(before))
 }
})
