import { describe, expect, it } from 'vitest'
import {
  contrastingTextColor, describeFlyerChanges, flyerEditSchema, referencedProducts, resolveAddressValue, resolveColorValue,
  resolveFlyerEdits, resolveWhatsappValue, validFlyerEdits, type FlyerEdit
} from '../../server/utils/whatsapp-creation/flyer-edits'

const products = [
  { id: 'p1', name: 'Arroz Tio João' },
  { id: 'p2', name: 'Feijão Carioca' },
  { id: 'p3', name: 'Cerveja Pilsen' }
]
const noAlcohol = products.slice(0, 2)
const edit = (value: Partial<FlyerEdit> & Pick<FlyerEdit, 'target' | 'operation' | 'evidence'>): FlyerEdit => flyerEditSchema.parse(value)
const run = (edits: FlyerEdit[], text: string, extra: Partial<Parameters<typeof resolveFlyerEdits>[1]> = {}) =>
  resolveFlyerEdits(validFlyerEdits(edits, text), { text, products: noAlcohol, ...extra })

describe('validação das edições propostas pela IA', () => {
  it('exige evidência literal na mensagem e combinação conhecida', () => {
    const logo = edit({ target: 'logo', operation: 'increase', evidence: 'aumenta a logo' })
    expect(validFlyerEdits([logo], 'Aumenta a LOGO um pouco')).toHaveLength(1)
    expect(validFlyerEdits([logo], 'manda o encarte')).toHaveLength(0)
    expect(validFlyerEdits([edit({ target: 'whatsapp', operation: 'increase', evidence: 'whatsapp' })], 'troca o whatsapp')).toHaveLength(0)
    expect(validFlyerEdits([edit({ target: 'logo', operation: 'increase', evidence: 'x' })], 'x')).toHaveLength(0)
  })

  it('rejeita campos desconhecidos no contrato', () => {
    expect(() => flyerEditSchema.parse({ target: 'logo', operation: 'increase', evidence: 'logo', accountId: 'x' })).toThrow()
  })
})

describe('escalas relativas', () => {
  it('aplica 1.1/1.2/1.35 sobre o valor atual e inverte para diminuir', () => {
    const text = 'aumenta bastante a logo'
    const lot = run([edit({ target: 'logo', operation: 'increase', amount: 'lot', evidence: text })], text)
    expect(lot.customization?.logoScale).toBe(1.35)
    const little = run([edit({ target: 'logo', operation: 'increase', amount: 'little', evidence: 'aumenta' })], 'aumenta a logo', { customization: { logoScale: 1.2 } })
    expect(little.customization?.logoScale).toBe(1.32)
    const down = run([edit({ target: 'product_names', operation: 'decrease', evidence: 'diminui' })], 'diminui o nome')
    expect(down.customization?.nameScale).toBeCloseTo(1 / 1.2, 2)
  })

  it('para no limite e avisa que já está no máximo', () => {
    const result = run([edit({ target: 'logo', operation: 'increase', amount: 'lot', evidence: 'aumenta' })], 'aumenta a logo', { customization: { logoScale: 1.8 } })
    expect(result.changed).toBe(false)
    expect(result.notices.join(' ')).toMatch(/já está no máximo que cabe no modelo/)
  })

  it('limita no teto sem passar do máximo e registra o aviso de limite', () => {
    const result = run([edit({ target: 'logo', operation: 'increase', amount: 'lot', evidence: 'aumenta' })], 'aumenta a logo', { customization: { logoScale: 1.6 } })
    expect(result.customization?.logoScale).toBe(1.8)
    expect(result.changes[0]).toMatch(/no limite do modelo/)
  })

  it('selo +18 sem produto alcoólico não muda nada', () => {
    const result = run([edit({ target: 'alcohol_badge', operation: 'increase', evidence: 'selo 18' })], 'aumenta o selo 18')
    expect(result.changed).toBe(false)
    expect(result.notices[0]).toMatch(/Nenhum produto/)
  })
})

describe('selo decorativo do modelo', () => {
  it('sem produto alcoólico “aumenta o selo” é o selo do modelo', () => {
    const result = run([edit({ target: 'seal', operation: 'increase', evidence: 'aumenta o selo' })], 'aumenta o selo')
    expect(result.customization?.sealScale).toBe(1.2)
    expect(result.asks).toEqual([])
  })

  it('com produto alcoólico e sem contexto pergunta qual selo', () => {
    const result = run([edit({ target: 'seal', operation: 'increase', evidence: 'aumenta o selo' })], 'aumenta o selo', { products })
    expect(result.asks).toEqual([{ kind: 'seal', operation: 'increase', amount: 'normal' }])
    expect(result.changed).toBe(false)
  })

  it('com contexto do modelo não pergunta', () => {
    const result = run([edit({ target: 'seal', operation: 'increase', evidence: 'selo do modelo' })], 'aumenta o selo do modelo', { products })
    expect(result.customization?.sealScale).toBe(1.2)
  })
})

describe('cores, contato, data e fotos', () => {
  it('cor por nome gera hexadecimal e contraste automático no nome', () => {
    const text = 'muda a cor do destaque para vermelho'
    const result = run([edit({ target: 'highlight_color', operation: 'set', value: 'vermelho', evidence: 'cor do destaque' })], text)
    expect(result.customization?.palette).toEqual({ highlightCardColor: '#dc2626', highlightProdNameColor: '#ffffff' })
    expect(contrastingTextColor('#ffd400')).toBe('#111111')
  })

  it('cor que não foi dita ou hexadecimal fora da mensagem é recusada', () => {
    expect(resolveColorValue('vermelho', 'quero azul')).toBeUndefined()
    expect(resolveColorValue('#ff0000', 'quero vermelho')).toBeUndefined()
    expect(resolveColorValue('#ff0000', 'usa #FF0000')).toBe('#ff0000')
    const semCor = run([edit({ target: 'card_color', operation: 'set', evidence: 'cor dos cards' })], 'muda a cor dos cards')
    expect(semCor.asks).toEqual([{ kind: 'color_value', target: 'card_color' }])
  })

  it('WhatsApp precisa ter 10 a 13 dígitos presentes na mensagem', () => {
    expect(resolveWhatsappValue('(11) 98888-7777', 'meu whatsapp é (11) 98888-7777')).toBe('(11) 98888-7777')
    expect(resolveWhatsappValue('11988887777', 'o numero é 11 98888 7777')).toBe('11988887777')
    expect(resolveWhatsappValue('1198888', 'whatsapp 1198888')).toBeUndefined()
    expect(resolveWhatsappValue('11988880000', 'whatsapp 11 98888 7777')).toBeUndefined()
  })

  it('endereço literal até 300 caracteres', () => {
    expect(resolveAddressValue('Rua das Flores, 100', 'troca o endereço para Rua das Flores, 100')).toBe('Rua das Flores, 100')
    expect(resolveAddressValue('Rua Inventada, 1', 'troca o endereço')).toBeUndefined()
    expect(resolveAddressValue('x'.repeat(301), 'x'.repeat(301))).toBeUndefined()
  })

  it('WhatsApp diferente do cadastro pergunta o escopo; igual ao cadastro só avisa', () => {
    const text = 'troca o whatsapp para (11) 98888-7777'
    const base = [edit({ target: 'whatsapp', operation: 'set', value: '(11) 98888-7777', evidence: 'troca o whatsapp' })]
    const different = run(base, text, { profile: { whatsapp: '(11) 90000-0000' } })
    expect(different.asks).toEqual([{ kind: 'business_scope', field: 'whatsapp', value: '(11) 98888-7777', persistRequested: false }])
    expect(different.customization).toBeUndefined()
    const same = run(base, text, { profile: { whatsapp: '11 98888 7777' } })
    expect(same.asks).toEqual([])
    expect(same.notices[0]).toMatch(/já é o do cadastro/)
    const local = run([edit({ target: 'whatsapp', operation: 'set', value: '(11) 98888-7777', persist: 'order', evidence: 'só nesse encarte' })],
      'só nesse encarte o whatsapp é (11) 98888-7777', { profile: { whatsapp: '(11) 90000-0000' } })
    expect(local.customization?.business?.whatsapp).toBe('(11) 98888-7777')
  })

  it('WhatsApp sem número pergunta o valor', () => {
    const result = run([edit({ target: 'whatsapp', operation: 'set', evidence: 'troca o whatsapp' })], 'troca o whatsapp')
    expect(result.asks).toEqual([{ kind: 'business_value', field: 'whatsapp' }])
  })

  it('data por extenso exige validade que vire datas', () => {
    const base = [edit({ target: 'validity_format', operation: 'set', value: 'por extenso', evidence: 'data por extenso' })]
    const ok = run(base, 'coloca a data por extenso', { validity: '06 e 07 de outubro', today: new Date('2026-10-01T12:00:00Z') })
    expect(ok.customization?.validityDateFormat).toBe('long')
    const sem = run(base, 'coloca a data por extenso', { validity: 'esta semana' })
    expect(sem.asks).toEqual([{ kind: 'validity_dates' }])
  })

  it('duplicação de fotos: todos, por item e escopo indefinido', () => {
    const all = run([edit({ target: 'product_images', operation: 'set', value: '3 fotos', evidence: 'duplica a foto' })], 'duplica a foto em 3')
    expect(all.customization?.imageFill).toEqual({ count: 3 })
    const item = run([edit({ target: 'product_images', operation: 'set', value: '2 lado a lado', scope: 'items', itemNumbers: [2], evidence: 'foto do feijão' })], 'duas fotos lado a lado na foto do feijão')
    expect(item.customization?.itemImageFill).toEqual({ p2: { count: 2, direction: 'horizontal' } })
    const unclear = run([edit({ target: 'product_images', operation: 'set', value: '2', scope: 'unclear', evidence: 'duplica' })], 'duplica 2')
    expect(unclear.asks).toEqual([{ kind: 'items', target: 'product_images' }])
  })
})

describe('etiqueta de preço', () => {
  it('pede a etiqueta com escopo indefinido quando a pessoa não diz qual', () => {
    const result = run([edit({ target: 'price_label', operation: 'choose', evidence: 'troca a etiqueta' })], 'troca a etiqueta')
    expect(result.asks).toEqual([{ kind: 'label', scope: 'unclear', itemIds: [] }])
  })

  it('resolve produto citado pelo nome e por número', () => {
    const named = run([edit({ target: 'price_label', operation: 'choose', scope: 'items', evidence: 'etiqueta do arroz tio joão' })], 'muda a etiqueta do arroz tio joão')
    expect(named.asks).toEqual([{ kind: 'label', scope: 'items', itemIds: ['p1'] }])
    const numbered = run([edit({ target: 'price_label', operation: 'choose', scope: 'items', itemNumbers: [2, 9], evidence: 'etiqueta' })], 'etiqueta do 2')
    expect(numbered.asks).toEqual([{ kind: 'label', scope: 'items', itemIds: ['p2'] }])
    expect(referencedProducts('quero o feijão carioca', noAlcohol)).toEqual([noAlcohol[1]])
  })
})

describe('resumo', () => {
  it('junta mudanças e avisos em uma resposta curta', () => {
    const result = run([
      edit({ target: 'logo', operation: 'increase', evidence: 'aumenta a logo' }),
      edit({ target: 'product_names', operation: 'increase', amount: 'lot', evidence: 'nomes bem maiores' })
    ], 'aumenta a logo e deixa os nomes bem maiores')
    expect(describeFlyerChanges(result)).toMatch(/^Pronto: a logo maior \(\+20%\) e o nome dos produtos maior \(\+35%\)\.$/)
  })
})
