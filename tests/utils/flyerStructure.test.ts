import { describe, expect, it } from 'vitest'
import { arrangeFlyerSectorBands, assignProductsToZones, chooseFlyerStructure, planFlyerSectors, resolveFlyerDepartment, OTHER_OFFERS_TITLE } from '../../utils/flyerStructure'

const p = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, ...extra })

describe('estrutura inteligente do encarte', () => {
  it('classifica ofertas reais de supermercado pelo nome', () => {
    const cases: Array<[string, string]> = [
      ['ÁGUA SANITÁRIA YPÊ 1L', 'LIMPEZA'],
      ['AMACIANTE DOWNY FRAGRÂNCIAS 1L', 'LIMPEZA'],
      ['SABÃO EM PÓ TIXAN YPÊ 2,2KG PRIMAVERA', 'LIMPEZA'],
      ['ARROZ CRISTAL 5KG', 'MERCEARIA'],
      ['CAFÉ PILÃO 500G TRADICIONAL VÁCUO', 'MERCEARIA'],
      ['LEITE EM PÓ NINHO 380G INTEGRAL', 'MERCEARIA'],
      ['CREME DE LEITE DAUS 200G', 'MERCEARIA'],
      ['FARINHA DE MILHO FLOCÃO SINHÁ 400G', 'MERCEARIA'],
      ['BATATA BEM BRASIL AIR FRYER 700G', 'CONGELADOS'],
      ['PIZZA SADIA SABORES 460G', 'CONGELADOS'],
      ['PÃO DE ALHO FRICO SABORES 400G', 'CONGELADOS'],
      ['REQUEIJÃO CATUPIRY 200G TRADICIONAL COPO', 'FRIOS E LATICÍNIOS'],
      ['DANONE LÍQUIDO MORANGO 1250G', 'FRIOS E LATICÍNIOS'],
      ['CERVEJA AMSTEL 269ML LATA', 'BEBIDAS'],
      ['CREME DENTAL COLGATE 180G', 'HIGIENE E BELEZA'],
      ['DESODORANTE AEROSOL MOOD 150ML', 'HIGIENE E BELEZA'],
      ['PICANHA BOVINA KG', 'AÇOUGUE'],
      ['COXA E SOBRECOXA DE FRANGO KG', 'AÇOUGUE'],
      ['BANANA PRATA KG', 'HORTIFRÚTI'],
      ['BATATA INGLESA KG', 'HORTIFRÚTI'],
      ['PÃO FRANCÊS KG', 'PADARIA'],
      ['MOLHO DE TOMATE DEZ 300G TRADICIONAL SACHÊ', 'MERCEARIA'],
      ['CALDO DE CARNE KNORR 57G', 'MERCEARIA'],
      ['BATATA PALHA ELMA CHIPS 120G', 'MERCEARIA'],
      ['SARDINHA EM LATA GOMES DA COSTA', 'MERCEARIA']
    ]
    for (const [name, department] of cases) expect([name, resolveFlyerDepartment({ name })]).toEqual([name, department])
  })

  it('usa o departamento informado quando reconhecível e ignora valores desconhecidos', () => {
    expect(resolveFlyerDepartment({ name: 'ARROZ 5KG', department: 'Carnes' })).toBe('AÇOUGUE')
    expect(resolveFlyerDepartment({ name: 'ARROZ 5KG', department: 'hortifrúti' })).toBe('HORTIFRÚTI')
    expect(resolveFlyerDepartment({ name: 'ARROZ 5KG', department: 'xyz' })).toBe('MERCEARIA')
    expect(resolveFlyerDepartment({ name: 'PRODUTO GENÉRICO' })).toBe('')
  })

  it('monta setores pelos departamentos presentes, na ordem do corredor', () => {
    const products = [
      p('1', 'DETERGENTE YPÊ 500ML'), p('2', 'ARROZ 5KG'), p('3', 'CERVEJA SKOL LATA'),
      p('4', 'AMACIANTE DOWNY 1L'), p('5', 'FEIJÃO CARIOCA 1KG'), p('6', 'CERVEJA AMSTEL LATA'),
      p('7', 'PICANHA KG')
    ]
    const sectors = planFlyerSectors(products, 'feed')
    expect(sectors.map(s => s.title)).toEqual(['MERCEARIA', 'BEBIDAS', 'LIMPEZA', OTHER_OFFERS_TITLE])
    expect(sectors.find(s => s.title === 'LIMPEZA')!.productIds).toEqual(['1', '4'])
    expect(sectors.at(-1)!.productIds).toEqual(['7'])
  })

  it('respeita o limite de setores do formato mantendo os maiores', () => {
    const products = [
      p('a1', 'ARROZ'), p('a2', 'FEIJÃO'), p('a3', 'CAFÉ'),
      p('b1', 'CERVEJA SKOL'), p('b2', 'REFRIGERANTE'),
      p('c1', 'DETERGENTE'), p('c2', 'AMACIANTE'), p('c3', 'DESINFETANTE'),
      p('d1', 'PICANHA'), p('d2', 'ALCATRA')
    ]
    const sectors = planFlyerSectors(products, 'square')
    expect(sectors.length).toBe(3)
    expect(sectors.map(s => s.title)).toEqual(['MERCEARIA', 'LIMPEZA', OTHER_OFFERS_TITLE])
    expect(sectors.at(-1)!.productIds.sort()).toEqual(['b1', 'b2', 'd1', 'd2'])
  })

  it('divide setores grandes em linhas e equilibra as colunas', () => {
    const products = Array.from({ length: 6 }, (_, i) => p(String(i), `ARROZ ${i}`))
    expect(planFlyerSectors(products, 'feed')[0]).toMatchObject({ rows: 2, columns: 3 })
    expect(planFlyerSectors(products.slice(0, 3), 'feed')[0]).toMatchObject({ rows: 1, columns: 3 })
  })

  it('escolhe Setores para ofertas misturadas', () => {
    const plan = chooseFlyerStructure([
      p('1', 'ARROZ 5KG'), p('2', 'FEIJÃO 1KG'), p('3', 'DETERGENTE YPÊ'), p('4', 'AMACIANTE DOWNY'),
      p('5', 'CERVEJA SKOL'), p('6', 'CERVEJA AMSTEL')
    ])
    expect(plan.structure).toBe('setores')
    expect(plan.sectors.map(s => s.title)).toEqual(['MERCEARIA', 'BEBIDAS', 'LIMPEZA'])
    expect(plan.reason).toContain('3 setores')
  })

  it('escolhe Produto Herói quando há destaque, mesmo com um setor só', () => {
    const plan = chooseFlyerStructure([
      p('1', 'ARROZ 5KG', { featured: true }), p('2', 'FEIJÃO 1KG'), p('3', 'CAFÉ 500G'), p('4', 'AÇÚCAR 5KG')
    ])
    expect(plan).toMatchObject({ structure: 'heroi', heroIds: ['1'], sectors: [] })
  })

  it('o destaque marcado vale mais que a separação por setores', () => {
    const plan = chooseFlyerStructure([
      p('1', 'ARROZ 5KG', { featured: true }), p('2', 'FEIJÃO 1KG'), p('3', 'DETERGENTE YPÊ'), p('4', 'AMACIANTE DOWNY')
    ])
    expect(plan.structure).toBe('heroi')
  })

  it('escolhe Faixa Lateral para poucas ofertas e Clássico para listas maiores ou TV', () => {
    const few = Array.from({ length: 8 }, (_, i) => p(String(i), `ARROZ ${i}`))
    const many = Array.from({ length: 14 }, (_, i) => p(String(i), `ARROZ ${i}`))
    expect(chooseFlyerStructure(few).structure).toBe('lateral')
    expect(chooseFlyerStructure(few, { format: 'tv' }).structure).toBe('classico')
    expect(chooseFlyerStructure(many).structure).toBe('classico')
  })

  it('não separa em setores quando muita coisa fica sem classificação', () => {
    const plan = chooseFlyerStructure([
      p('1', 'ARROZ'), p('2', 'FEIJÃO'), p('3', 'DETERGENTE'), p('4', 'AMACIANTE'),
      p('5', 'ITEM A'), p('6', 'ITEM B'), p('7', 'ITEM C')
    ])
    expect(plan.structure).toBe('lateral')
  })

  it('junta setores pequenos na mesma faixa e deixa os cheios sozinhos', () => {
    const products = [
      p('m1', 'ARROZ'), p('m2', 'FEIJÃO'), p('m3', 'CAFÉ'), p('m4', 'AÇÚCAR'),
      p('l1', 'DETERGENTE'), p('l2', 'AMACIANTE'), p('l3', 'DESINFETANTE'),
      p('b1', 'CERVEJA SKOL'), p('b2', 'CERVEJA AMSTEL'),
      p('c1', 'PIZZA SADIA'), p('c2', 'LASANHA')
    ]
    const bands = arrangeFlyerSectorBands(planFlyerSectors(products, 'feed'), 'feed')
    expect(bands.map(band => band.sectors.map(s => s.title))).toEqual([['CONGELADOS', 'BEBIDAS'], ['MERCEARIA'], ['LIMPEZA']])
    expect(bands.every(band => band.sectors.reduce((sum, s) => sum + s.columns, 0) <= 4)).toBe(true)
  })

  it('setor com mais de uma linha não divide faixa', () => {
    const products = [...Array.from({ length: 6 }, (_, i) => p(`m${i}`, `ARROZ ${i}`)), p('b1', 'CERVEJA'), p('b2', 'REFRIGERANTE')]
    const bands = arrangeFlyerSectorBands(planFlyerSectors(products, 'feed'), 'feed')
    expect(bands.map(band => band.sectors.length)).toEqual([1, 1])
    expect(bands[0]!.rows).toBe(2)
  })

  it('não divide em setores quando as ofertas não cabem no formato sem cards miúdos', () => {
    const many = [...Array.from({ length: 5 }, (_, i) => p(`m${i}`, `ARROZ ${i}`)), ...Array.from({ length: 5 }, (_, i) => p(`l${i}`, `DETERGENTE ${i}`))]
    expect(chooseFlyerStructure(many, { format: 'feed' }).structure).toBe('setores')
    expect(chooseFlyerStructure(many, { format: 'square' }).structure).toBe('classico')
  })

  it('a escolha do cliente prevalece', () => {
    const plan = chooseFlyerStructure([p('1', 'ARROZ'), p('2', 'DETERGENTE'), p('3', 'FEIJÃO'), p('4', 'AMACIANTE')], { preferred: 'classico' })
    expect(plan.structure).toBe('classico')
  })
})


describe('distribuição das ofertas entre zonas', () => {
  const p = (id: string, name: string) => ({ id, name })
  it('zona com nome de setor recebe as ofertas do setor; o resto vai para a zona livre', () => {
    const result = assignProductsToZones(
      [p('1', 'ARROZ'), p('2', 'DETERGENTE'), p('3', 'FEIJÃO'), p('4', 'ITEM X')],
      [{ id: 'merc', name: 'Mercearia', area: 100 }, { id: 'livre', name: '', area: 100 }])
    expect(result).toEqual({ merc: ['1', '3'], livre: ['2', '4'] })
  })
  it('sem setores, divide pela área e não perde nenhuma oferta', () => {
    const products = Array.from({ length: 10 }, (_, i) => p(String(i), `ITEM ${i}`))
    const result = assignProductsToZones(products, [{ id: 'a', area: 300 }, { id: 'b', area: 100 }, { id: 'c', area: 100 }])
    expect(result.a!.length).toBe(6)
    expect(result.b!.length + result.c!.length).toBe(4)
    expect(Object.values(result).flat().sort()).toEqual(products.map(x => x.id).sort())
  })
  it('todas as zonas são setores: ofertas sem setor vão para todas, pela área', () => {
    const result = assignProductsToZones([p('1', 'ARROZ'), p('2', 'ITEM X')], [{ id: 'merc', name: 'Mercearia', area: 100 }, { id: 'beb', name: 'Bebidas', area: 100 }])
    expect(Object.values(result).flat().sort()).toEqual(['1', '2'])
    expect(result.merc).toContain('1')
  })
})
