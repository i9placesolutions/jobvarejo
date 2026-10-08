import { describe, expect, it } from 'vitest'
import { orderForStructure, pickFlyerStructure, structureNotice } from '../../server/utils/whatsapp-creation/flyer-structure'
import { normalizeFlyerCustomization } from '../../shared/whatsapp-creation'
import { resolveFlyerEdits, resolveStructureChoice, validFlyerEdits } from '../../server/utils/whatsapp-creation/flyer-edits'

const product = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, brand: '', variant: '', weight: '', price: '9,99', ...extra })
const blueprints = ['heroi', 'setores', 'lateral'].flatMap(structureId => ['feed', 'stories'].map(formatId => ({ structureId, formatId, width: 1080, height: 1350, canvasDataPath: `projects/x/${structureId}-${formatId}.json.gz` })))
const config = { structureBlueprints: blueprints }
const mixed = [product('1', 'ARROZ 5KG'), product('2', 'FEIJÃO'), product('3', 'DETERGENTE YPÊ'), product('4', 'AMACIANTE DOWNY'), product('5', 'CERVEJA SKOL'), product('6', 'CERVEJA AMSTEL')]

describe('estrutura do encarte no pedido do WhatsApp', () => {
  it('ofertas misturadas usam a variação Setores do modelo', () => {
    const picked = pickFlyerStructure({ products: mixed, division: 'single' }, undefined, config, 'feed')
    expect(picked?.plan.structure).toBe('setores')
    expect(picked?.blueprint?.canvasDataPath).toBe('projects/x/setores-feed.json.gz')
    expect(structureNotice(picked!.plan, false)).toMatch(/Separei as ofertas por setor \(mercearia, bebidas, limpeza\)/)
  })

  it('modelo sem variações, divisão em páginas ou formato sem variação ficam no Clássico', () => {
    expect(pickFlyerStructure({ products: mixed, division: 'single' }, undefined, {}, 'feed')).toBeNull()
    expect(pickFlyerStructure({ products: mixed, division: 'pages' }, undefined, config, 'feed')).toBeNull()
    const square = pickFlyerStructure({ products: mixed, division: null }, undefined, config, 'square')
    expect(square).toMatchObject({ plan: { structure: 'classico' }, blueprint: null })
  })

  it('a escolha do cliente e os destaques mandam na estrutura', () => {
    const custom = normalizeFlyerCustomization({ structure: 'classico' })
    expect(pickFlyerStructure({ products: mixed, division: 'single' }, custom, config, 'feed')).toMatchObject({ plan: { structure: 'classico' }, blueprint: null })
    const featured = normalizeFlyerCustomization({ featuredProductIds: ['5'] })
    const picked = pickFlyerStructure({ products: mixed, division: 'single' }, featured, config, 'stories')!
    expect(picked.plan.structure).toBe('heroi')
    expect(orderForStructure(mixed, picked.plan).map(item => item.id)).toEqual(['5', '1', '2', '3', '4', '6'])
    expect(structureNotice(picked.plan, true)).toBeNull()
  })

  it('o cliente troca a estrutura e marca destaques pela conversa', () => {
    expect(resolveStructureChoice('separa por setor')).toBe('setores')
    expect(resolveStructureChoice('pode deixar tudo junto')).toBe('classico')
    expect(resolveStructureChoice('quero a faixa lateral')).toBe('lateral')
    const bySector = resolveFlyerEdits([{ target: 'structure', operation: 'set', value: 'separa por setor', evidence: '' }], { text: 'separa por setor', products: mixed })
    expect(bySector.customization?.structure).toBe('setores')
    expect(bySector.changes).toEqual(['encarte separado por setor'])
    const hero = resolveFlyerEdits([{ target: 'featured_products', operation: 'set', itemNumbers: [1], evidence: '' }], { text: 'o arroz é o carro-chefe', products: mixed })
    expect(hero.customization).toMatchObject({ structure: 'heroi', featuredProductIds: ['1'] })
    // A validação de evidência aceita os novos alvos (sem isso eles seriam descartados em silêncio).
    expect(validFlyerEdits([{ target: 'structure', operation: 'set', value: 'setor', evidence: '' }], 'separa por setor')).toHaveLength(1)
    expect(validFlyerEdits([{ target: 'featured_products', operation: 'set', itemNumbers: [1], evidence: '' }], 'o arroz é o carro-chefe')).toHaveLength(1)
    expect(validFlyerEdits([{ target: 'structure', operation: 'set', evidence: '' }], 'aumenta a logo')).toHaveLength(0)
    const none = resolveFlyerEdits([{ target: 'featured_products', operation: 'hide', evidence: '' }], { text: 'tira o destaque', products: mixed, customization: hero.customization })
    expect(none.customization?.featuredProductIds).toBeUndefined()
    expect(none.customization?.structure).toBe('classico')
  })
})
