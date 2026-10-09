import {describe,it,expect} from 'vitest'
import {newVideoFromTemplate} from '../../shared/video-studio/templates'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
import type {FlyerRecipe} from '../../shared/video-studio/flyer-recipes'
import {personalizedRecipe,showVideoAlcoholBadge} from '../../shared/video-studio/personalization'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {videoOfferFromList} from '../../shared/video-studio/list-import'
import {isVideoModel} from '../../shared/video-studio/project-kind'
import {productLayers} from '../../shared/video-studio/product-layout'

describe('personalização privada de vídeos',()=>{
 it('aplica a hierarquia de Reels ao catálogo inteiro, com nome fora da foto e preço destacado',()=>{
  for(const recipe of Object.values(FLYER_RECIPES).filter(r=>!r.referenceArtwork&&!r.preserveVerticalLayout)){
   const l=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id)).vertical
   expect(l.name[1]-(l.seal[1]+l.seal[3])).toBe(24)
   expect(l.product[1]-(l.name[1]+l.name[3])).toBe(20)
   expect(l.price[2]).toBeGreaterThanOrEqual(900)
   expect(l.price[3]).toBeGreaterThanOrEqual(280)
   expect(l.product[3]).toBeGreaterThanOrEqual(611)
   expect(l.price[1]+l.price[3]).toBeLessThan(l.condition[1])
   expect(l.condition[1]+l.condition[3]).toBeLessThan(l.logo[1])
   expect(l.logo[1]+l.logo[3]).toBeLessThan(l.validity[1])
   expect(productLayers(l.product,true,true,.4)).toHaveLength(2)
   expect(productLayers(l.product,true,true,l.product[2]/l.product[3])).toHaveLength(1)
   expect(productLayers(l.product,true,false,.4)).toHaveLength(1)
  }
 })
 it('mantém o cabeçalho próprio de selo, logo e faixa de validade quando a receita pede',()=>{
  const recipes=Object.values(FLYER_RECIPES).filter(r=>r.preserveVerticalLayout)
  expect(recipes.length).toBeGreaterThan(0)
  for(const recipe of recipes){
   const l=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id)).vertical
   expect(l).toEqual(recipe.vertical)
   // Selo e logo lado a lado (qualquer lado) ou selo acima da logo, sem sobreposição; faixa de validade abaixo da logo e acima da oferta.
   const apart=l.seal[0]+l.seal[2]<=l.logo[0]||l.logo[0]+l.logo[2]<=l.seal[0]||l.seal[1]+l.seal[3]<=l.logo[1]
   expect(apart,recipe.name).toBe(true)
   expect(l.logo[1]+l.logo[3]).toBeLessThanOrEqual(l.validity[1])
   expect(l.validity[1]+l.validity[3]).toBeLessThanOrEqual(l.product[1])
   expect(l.product[1]+l.product[3]).toBeLessThanOrEqual(l.name[1])
   expect(l.price[1]+l.price[3]).toBeLessThanOrEqual(l.condition[1])
  }
 })
 it('preserva a identidade ampliada com validade dentro da margem do zoom',()=>{
  for(const recipe of Object.values(FLYER_RECIPES).filter(r=>r.preserveBrandLayout)){
   const result=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id))
   // Cabeçalho próprio (selo + logo no topo, como no encarte) não segue a ordem do Reels comum.
   if(!recipe.preserveVerticalLayout)expect(result.vertical.logo[1]).toBeGreaterThan(result.vertical.price[1]+result.vertical.price[3])
   for(const [layout,height] of [[result.vertical,1920],[result.horizontal,1080]] as const){
    const [,y,,h]=layout.validity
    expect((y+h-height/2)*1.045+height/2).toBeLessThan(height)
    expect(layout.logo[1]+layout.logo[3]).toBeLessThan(y)
   }
  }
 })
 it('mantém o produto separado do selo e só a base atrás da etiqueta na coleção Economia',()=>{
  for(const recipe of Object.values(FLYER_RECIPES).filter(r=>r.preserveBrandLayout)){
   const layout=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id))
   expect(layout.vertical.product[1]-layout.vertical.seal[1]-layout.vertical.seal[3]).toBeGreaterThanOrEqual(35)
   for(const part of [layout.vertical,layout.horizontal]){
    const [,y,,height]=part.product
    const overlap=Math.max(0,y+height-part.price[1])
    expect(overlap/height).toBeLessThanOrEqual(.1)
   }
  }
 })
 it('não herda a empresa da campanha usada como origem do modelo',()=>{
  // Modelo com nome de loja no título ("Atacado Barlow"): a campanha vem do modelo, a empresa não.
  const recipe=FLYER_RECIPES['flyer-ea0d0789-3081-409c-b830-10739806b065']!
  const doc=newVideoFromTemplate(recipe.id)
  expect(doc.campaign).toBe('Semana do Cliente')
  expect(doc.brand.name).toBe('')
  expect(personalizedRecipe(recipe,doc).seal).toBe(recipe.seal)
 })
 it('troca o título rasterizado por texto sem alterar a receita global',()=>{
  const recipe=Object.values(FLYER_RECIPES).find(r=>r.seal)!,before=JSON.stringify(recipe)
  const doc=newVideoFromTemplate(recipe.id);doc.campaign='Festival da minha loja';doc.appearance={accent:'#abcdef',textColor:'#fefefe'}
  const customized=personalizedRecipe(recipe,doc)
  expect(customized.seal).toBe('');expect(customized.nativeTitle).toBe(doc.campaign);expect(customized.accent).toBe('#abcdef')
  expect(JSON.stringify(recipe)).toBe(before)
  expect(personalizedRecipe(recipe,newVideoFromTemplate(recipe.id)).seal).toBe(recipe.seal)
 })
 it('preserva as geometrias declaradas apenas enquanto a campanha usa o título da referência',()=>{
  const base=Object.values(FLYER_RECIPES).find(r=>r.seal)!
  const recipe={...structuredClone(base),referenceArtwork:{src:'/video-studio/templates/catalog/reference.png',width:1000,height:1500,headerBottom:.25,logoMask:[.6,.02,.3,.1],logoBox:[.61,.03,.28,.08],socialMask:[.6,.13,.3,.04],instagramBox:[.61,.135,.28,.03],colors:{logo:'#ffffff',social:'#123456',logoText:'#ffffff'},sourceIndex:1}} as FlyerRecipe
  const original=JSON.stringify({vertical:recipe.vertical,horizontal:recipe.horizontal})
  const standard=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id))
  expect(standard.referenceArtwork).toEqual(recipe.referenceArtwork)
  expect(JSON.stringify({vertical:standard.vertical,horizontal:standard.horizontal})).toBe(original)

  const changed=newVideoFromTemplate(recipe.id);changed.campaign='Campanha da minha loja'
  const personalized=personalizedRecipe(recipe,changed)
  const legacy=personalizedRecipe({...recipe,referenceArtwork:undefined},changed)
  expect(personalized.referenceArtwork).toBeUndefined()
  expect(personalized.seal).toBe('')
  expect(personalized.nativeTitle).toBe(changed.campaign)
  expect(personalized.vertical).toEqual(legacy.vertical)
  expect(personalized.horizontal).toEqual(legacy.horizontal)
 })
 it('mantém as geometrias dos cabeçalhos registrados sem personalização',()=>{
  for(const recipe of Object.values(FLYER_RECIPES).filter(r=>r.referenceArtwork)){
   const personalized=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id))
   expect(personalized.referenceArtwork).toEqual(recipe.referenceArtwork)
   expect(personalized.vertical).toEqual(recipe.vertical)
   expect(personalized.horizontal).toEqual(recipe.horizontal)
  }
 })
 it('reserva faixa acima da foto em todos os modelos TV',()=>{
  for(const recipe of Object.values(FLYER_RECIPES).filter(r=>!r.referenceArtwork)){
   const result=personalizedRecipe(recipe,newVideoFromTemplate(recipe.id))
   const [x,y,w,h]=result.horizontal.product,[nx,ny,nw,nh]=result.horizontal.name
   expect(ny+nh+25).toBeLessThanOrEqual(y)
   expect(nx).toBe(x);expect(nw).toBe(w)
   expect(h).toBeGreaterThan(100);expect(y+h).toBeLessThanOrEqual(1080)
  }
 })
 it('persiste cores e selo e recusa valores CSS arbitrários',()=>{
  const doc=newVideoFromTemplate();doc.appearance={textColor:'#e7f6ff',accent:'#74dcff',nameColor:'#112233',priceColor:'#223344',unitColor:'#334455',conditionColor:'#445566',validityColor:'#556677',contactColor:'#667788'}
  doc.offers=[videoOfferFromList({name:'Cerveja 350 ml',price:'3,99',limitText:'Limite de 6 por cliente'},'00000000-0000-4000-8000-000000000001')]
  const saved=videoDocumentSchema.parse(doc)
  expect(saved.offers[0]!.alcoholBadgeEnabled).toBe(true);expect(saved.offers[0]!.condition).toBe('Limite de 6 por cliente')
  expect(saved.appearance).toEqual(doc.appearance)
  doc.appearance.textColor='url(https://example.com)';expect(videoDocumentSchema.safeParse(doc).success).toBe(false)
 })
 it('respeita a correção manual do selo e não marca bebida sem álcool',()=>{
  const offer=videoOfferFromList({name:'Cerveja sem álcool',price:'3,99'},'a')
  expect(showVideoAlcoholBadge(offer)).toBe(false)
  offer.alcoholBadgeEnabled=true;expect(showVideoAlcoholBadge(offer)).toBe(true)
  offer.name='Vinho tinto';offer.alcoholBadgeEnabled=false;expect(showVideoAlcoholBadge(offer)).toBe(false)
  delete offer.alcoholBadgeEnabled;expect(showVideoAlcoholBadge(offer)).toBe(true)
 })
 it('identifica modelos históricos e mantém projetos normais editáveis',()=>{
  expect(isVideoModel({title:'Quinta — Modelo de demonstração'})).toBe(true)
  expect(isVideoModel({title:'Ofertas do Açougue — Demonstração ilustrativa'})).toBe(true)
  expect(isVideoModel({title:'Fecha Mês — Modelo profissional'})).toBe(true)
  expect(isVideoModel({title:'Quinta — Modelo de demonstração — cópia'})).toBe(false)
  expect(isVideoModel({title:'Quinta — meu vídeo'})).toBe(false)
 })
})
