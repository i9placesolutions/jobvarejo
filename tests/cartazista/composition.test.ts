import { describe, expect, it } from 'vitest'
import { CARTAZISTA_FORMATS } from '~/types/cartazista'
import { CARTAZISTA_STARTER_MODELS } from '~/utils/cartazista/catalog'
import {
  applyCartazistaProduct,
  createCartazistaDocument,
  parseCartazistaProductList
} from '~/utils/cartazista/composition'
import { cartazistaPrintableCompositions, rebuildCartazistaComposition } from '~/utils/cartazista/composition'

describe('cartazista composition', () => {
  it('preserva cabeçalho cadastrado e edição de camadas ao imprimir outra oferta', () => {
    const doc=createCartazistaDocument({modelId:'leve-x-y'})
    doc.settings.header={id:'11111111-1111-4111-8111-111111111111',name:'Campanha cadastrada',background:'/video-studio/templates/background.png',seal:'/video-studio/templates/seal.png',color:'#123456'}
    const next=rebuildCartazistaComposition(doc)
    next.composition.layers.find(l=>l.id==='cartaz-product-name')!.x=75
    next.products.push({...next.products[0]!,id:'second',name:'OUTRO PRODUTO',price:5.99})
    const printed=cartazistaPrintableCompositions(next)
    expect(printed[1]!.layers.find(l=>l.id==='cartaz-campaign-seal')?.src).toBe(doc.settings.header.seal)
    expect(printed[1]!.layers.find(l=>l.id==='cartaz-product-name')).toMatchObject({text:'OUTRO PRODUTO',x:75})
    expect(printed[1]!.layers.some(l=>l.id==='cartaz-header-brush')).toBe(false)
  })

  it('separa corretamente os preços de atacado sem inventar desconto', () => {
    const doc=createCartazistaDocument({modelId:'wholesale-retail'})
    const updated=applyCartazistaProduct(doc.composition,doc.modelId,{...doc.products[0]!,price:12.49,wholesalePrice:9.79},doc.settings,doc.themeId)
    expect(updated.layers.find(l=>l.id==='cartaz-price')?.text).toBe('12')
    expect(updated.layers.find(l=>l.id==='cartaz-price-cents')?.text).toBe(',49')
    expect(updated.layers.find(l=>l.id==='cartaz-secondary-price')?.text).toBe('9')
    expect(updated.layers.find(l=>l.id==='cartaz-secondary-price-cents')?.text).toBe(',79')
  })
  it('mantém os dezesseis modelos observados no catálogo autenticado', () => {
    expect(CARTAZISTA_STARTER_MODELS).toHaveLength(16)
    expect(CARTAZISTA_STARTER_MODELS.map((model) => model.id)).toContain('wholesale-retail')
    expect(CARTAZISTA_STARTER_MODELS.map((model) => model.id)).toContain('leve-3-2')
  })

  it('interpreta uma lista de produtos com preço brasileiro e preço anterior', () => {
    const products = parseCartazistaProductList([
      'ARROZ CAMIL 5KG 29,99',
      'FEIJÃO KICALDO 1KG R$ 12,99 por R$ 9,99',
      'BANANA PRATA KG 5.99'
    ].join('\n'))

    expect(products).toHaveLength(3)
    expect(products[0]).toMatchObject({ name: 'ARROZ CAMIL 5KG', price: 29.99 })
    expect(products[1]).toMatchObject({ name: 'FEIJÃO KICALDO 1KG', oldPrice: 12.99, price: 9.99 })
    expect(products[2]).toMatchObject({ name: 'BANANA PRATA KG', price: 5.99 })
  })

  it('gera formatos A1-A7 e atualiza o preço sem perder as camadas editáveis', () => {
    const document = createCartazistaDocument({ modelId: 'de-por-discount', formatId: 'a3' })
    const updated = applyCartazistaProduct(
      document.composition,
      document.modelId,
      { ...document.products[0]!, name: 'CAFÉ ESPECIAL', price: 8.99, oldPrice: 12.99 },
      document.settings,
      document.themeId
    )

    expect(CARTAZISTA_FORMATS.map((format) => format.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'banner-2m'])
    expect(updated.layers.find((layer) => layer.id === 'cartaz-product-name')?.text).toBe('CAFÉ ESPECIAL')
    expect(updated.layers.find((layer) => layer.id === 'cartaz-price')?.text).toBe('8')
    expect(updated.layers.find((layer) => layer.id === 'cartaz-price-cents')?.text).toBe(',99')
    expect(updated.layers.find((layer) => layer.id === 'cartaz-old-price')?.visible).toBe(true)
    expect(updated.layers.some((layer) => layer.id === 'cartaz-logo')).toBe(true)
  })
  it('interpreta Leve/Pague como quantidades sem inventar preço monetário', () => {
    const products = parseCartazistaProductList('SABÃO EM PÓ 500G | 4 | 3', 'leve-pague')
    expect(products[0]).toMatchObject({ packQuantity: 4, payQuantity: 3, price: 0 })
    const doc = createCartazistaDocument({ modelId: 'leve-pague' })
    const next = applyCartazistaProduct(doc.composition, doc.modelId, products[0]!, doc.settings, doc.themeId)
    expect(next.layers.find(l => l.id === 'cartaz-price')?.text).toBe('4')
    expect(next.layers.find(l => l.id === 'cartaz-secondary-price')?.text).toBe('3')
    expect(next.layers.find(l => l.id === 'cartaz-price-cents')?.visible).toBe(false)
    expect(parseCartazistaProductList('SABÃO | 3 | 4', 'leve-pague')).toHaveLength(0)
  })
  it('cria a faixa horizontal na proporção física 200 × 62 cm', () => {
    const doc = createCartazistaDocument({ modelId: 'banner-2m' })
    expect(doc.formatId).toBe('banner-2m')
    expect(doc.composition.width / doc.composition.height).toBeCloseTo(200 / 62)
    expect(doc.composition.layers.find(l => l.id === 'cartaz-primary-label')?.visible).toBe(false)
  })
  it('aplica título, cifrão, dobra e remoção de fundo também ao cabeçalho', () => {
    const doc = createCartazistaDocument()
    Object.assign(doc.settings, { title: 'PROMOÇÃO', showCurrency: true, showEach: false, foldGuide: true, removeBackground: true })
    doc.settings.header={id:'11111111-1111-4111-8111-111111111111',name:'Horti',background:'/video-studio/templates/bg.png',seal:'/video-studio/templates/seal.png',color:'#123456'}
    const next = rebuildCartazistaComposition(doc).composition
    expect(next.layers.find(l => l.id === 'cartaz-price-currency')?.visible).toBe(true)
    expect(next.layers.find(l => l.id === 'cartaz-price-unit')?.visible).toBe(false)
    expect(next.layers.find(l => l.id === 'cartaz-fold-guide')?.visible).toBe(true)
    expect(next.layers.find(l => l.id === 'cartaz-campaign-background')?.visible).toBe(false)
  })
})
