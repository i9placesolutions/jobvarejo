import { describe, expect, it } from 'vitest'
import type { ProductZone } from '~/types/product-zone'
import {
  applyProductZoneStructureFormat,
  createDefaultProductZoneStructureMap,
  createDefaultProductZoneStructureMapByPreviewFormat,
  createDefaultProductZoneStructureVariantMap,
  normalizeProductZoneStructureMapByPreviewFormat,
  normalizeProductZoneStructureMap,
  normalizeProductZoneStructureVariantMap,
  normalizeProductZoneStructureVariantMapByPreviewFormat,
  getProductZonePreviewFormatForDimensions,
  resolveProductZoneStructure
} from '~/utils/product-zone-structure'
import {
  calculateGridLayout,
  createDefaultProductZone,
  migrateProductZone
} from '~/utils/product-zone-helpers'

const baseZone = (overrides: Partial<ProductZone> = {}): ProductZone => ({
  x: 0,
  y: 0,
  width: 900,
  height: 600,
  padding: 20,
  gapHorizontal: 12,
  gapVertical: 12,
  ...overrides
})

describe('product-zone-structure', () => {
  it('cria receitas independentes para todas as quantidades de 1 a 24', () => {
    const map = createDefaultProductZoneStructureMap(baseZone())

    expect(Object.keys(map)).toHaveLength(24)
    expect(map['1']?.count).toBe(1)
    expect(map['1']?.format).toBe('hero')
    expect(map['2']?.format).toBe('horizontal')
    expect(map['24']?.count).toBe(24)
    expect(map['24']?.columns).toBeGreaterThan(1)
    expect(map['24']?.highlightPadding).toBe(map['24']?.padding)
    expect(map['24']?.highlightGapHorizontal).toBe(map['24']?.gapHorizontal)
    expect(map['24']?.highlightGapVertical).toBe(map['24']?.gapVertical)
  })

  it('aplica formatos sem compartilhar a mesma referencia entre quantidades', () => {
    const map = createDefaultProductZoneStructureMap(baseZone())
    const nextTwo = applyProductZoneStructureFormat(map['2'], 2, 'horizontal', baseZone())
    const nextFour = applyProductZoneStructureFormat(map['4'], 4, 'vertical', baseZone())
    const nextSix = applyProductZoneStructureFormat(map['6'], 6, 'showcase', baseZone())

    expect(nextTwo.columns).toBe(2)
    expect(nextTwo.rows).toBe(1)
    expect(nextFour.columns).toBe(1)
    expect(nextFour.rows).toBe(4)
    expect(nextFour.layoutDirection).toBe('vertical')
    expect(nextSix.role).toBe('showcase')
    expect(nextSix.highlightCount).toBeGreaterThan(0)
    expect(nextTwo).not.toBe(map['2'])
    expect(nextFour).not.toBe(map['4'])
  })

  it('normaliza uma receita editada sem apagar as outras', () => {
    const map = normalizeProductZoneStructureMap({
      '2': {
        format: 'horizontal',
        columns: 2,
        rows: 1,
        cardAspectRatio: '4:3',
        cardAspectRatios: { '1': 'square', '2': '4:5' }
      },
      '24': { format: 'grid', columns: 6, rows: 4, lastRowBehavior: 'center' }
    }, baseZone())

    expect(map['2']?.cardAspectRatio).toBe('4:3')
    expect(map['2']?.cardAspectRatios).toEqual({ '1': 'square', '2': '4:5' })
    expect(map['1']?.cardAspectRatios).not.toBe(map['2']?.cardAspectRatios)
    expect(map['24']?.columns).toBe(6)
    expect(map['24']?.rows).toBe(4)
    expect(map['24']?.lastRowBehavior).toBe('fill')
    expect(map['24']?.highlightSelection).toBe('first')
    expect(map['24']?.highlightIndexes).toEqual([1])
    expect(map['24']?.highlightPadding).toBe(map['24']?.padding)
    expect(map['7']?.count).toBe(7)
    expect(map['7']?.padding).toBe(20)
  })

  it('normaliza receitas antigas para preencher a sobra da ultima linha', () => {
    const map = normalizeProductZoneStructureMap({
      '5': { columns: 3, rows: 2, lastRowBehavior: 'center' },
      '7': { columns: 3, rows: 3, lastRowBehavior: 'left' }
    }, baseZone())

    expect(map['5']?.lastRowBehavior).toBe('fill')
    expect(map['7']?.lastRowBehavior).toBe('fill')
  })

  it('resolve a receita pelo total e o relayout respeita a grade escolhida', () => {
    const map = createDefaultProductZoneStructureMap(baseZone())
    map['4'] = applyProductZoneStructureFormat(map['4'], 4, 'grid', baseZone())
    map['4'] = { ...map['4'], columns: 2, rows: 2, gapHorizontal: 10, gapVertical: 10 }
    const zone = baseZone({ structureByProductCount: map, structureByProductCountEnabled: true })

    const resolved = resolveProductZoneStructure(zone, 4)
    const layout = calculateGridLayout(zone, 4)

    expect(resolved?.columns).toBe(2)
    expect(resolved?.rows).toBe(2)
    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(2)
  })

  it('usa a direcao da receita ao calcular uma estrutura vertical', () => {
    const map = createDefaultProductZoneStructureMap(baseZone())
    map['6'] = {
      ...map['6']!,
      columns: 2,
      rows: 3,
      layoutDirection: 'vertical',
      gapHorizontal: 7,
      gapVertical: 9
    }
    const zone = baseZone({
      structureByProductCount: map,
      structureByProductCountEnabled: true,
      layoutDirection: 'horizontal',
      columns: 6,
      rows: 1
    })

    const layout = calculateGridLayout(zone, 6)

    expect(layout.cols).toBe(2)
    expect(layout.rows).toBe(3)
  })

  it('mantem varias receitas por quantidade e resolve a escolha da zona', () => {
    const map = createDefaultProductZoneStructureMap(baseZone())
    const variants = createDefaultProductZoneStructureVariantMap(baseZone(), map)
    const alternative = {
      ...map['4'],
      id: 'four-showcase',
      name: 'Destaques laterais',
      format: 'showcase' as const,
      role: 'showcase' as const,
      highlightCount: 2
    }
    const normalizedVariants = normalizeProductZoneStructureVariantMap({
      ...variants,
      '4': [variants['4']?.[0], alternative]
    }, baseZone(), map)
    const zone = baseZone({
      structureByProductCount: map,
      structureVariantsByProductCount: normalizedVariants,
      structureVariantByProductCount: { '4': 'four-showcase' }
    })

    expect(normalizedVariants['4']).toHaveLength(2)
    expect(normalizedVariants['4']?.[0]?.name).toBe('Padrão')
    expect(resolveProductZoneStructure(zone, 4)?.format).toBe('showcase')
    expect(resolveProductZoneStructure({
      ...zone,
      structureVariantByProductCount: {}
    }, 4)?.format).toBe(map['4']?.format)
  })

  it('mantem cada variacao completa independente dentro da mesma quantidade', () => {
    const variants = normalizeProductZoneStructureVariantMap({
      '2': [
        {
          id: 'two-grid',
          name: 'Grade',
          format: 'grid',
          columns: 2,
          rows: 1,
          cardAspectRatios: { '1': 'square', '2': '4:5' }
        },
        {
          id: 'two-column',
          name: 'Coluna',
          format: 'vertical',
          columns: 1,
          rows: 2,
          layoutDirection: 'vertical',
          cardAspectRatios: { '1': '16:9', '2': '9:16' }
        }
      ]
    }, baseZone())

    const zone = baseZone({
      structureByProductCount: createDefaultProductZoneStructureMap(baseZone()),
      structureVariantsByProductCount: variants,
      structureVariantByProductCount: { '2': 'two-grid' }
    })

    expect(resolveProductZoneStructure(zone, 2)).toMatchObject({
      format: 'grid',
      columns: 2,
      rows: 1,
      layoutDirection: 'horizontal'
    })

    const columnZone = {
      ...zone,
      structureVariantByProductCount: { '2': 'two-column' }
    }
    expect(resolveProductZoneStructure(columnZone, 2)).toMatchObject({
      format: 'vertical',
      columns: 1,
      rows: 2,
      layoutDirection: 'vertical'
    })

    expect(variants['2']?.[0]?.cardAspectRatios).not.toBe(variants['2']?.[1]?.cardAspectRatios)
    expect(variants['2']?.[0]?.highlightIndexes).not.toBe(variants['2']?.[1]?.highlightIndexes)
  })

  it('materializa o sistema novo ao criar ou migrar uma zona', () => {
    const created = createDefaultProductZone()
    const migrated = migrateProductZone({ columns: 3, rows: 2, gap: 8 })

    expect(Object.keys(created.structureByProductCount ?? {})).toHaveLength(24)
    expect(created.structureByProductCountEnabled).toBe(true)
    expect(Object.keys(created.structureVariantsByProductCount ?? {})).toHaveLength(24)
    expect(Object.keys(migrated.structureByProductCount ?? {})).toHaveLength(24)
    expect(migrated.structureByProductCountEnabled).toBe(true)
    expect(migrated.structureByProductCount?.['4']?.gapHorizontal).toBe(8)
  })

  it('migra o mapa legado para copias independentes por formato', () => {
    const legacy = createDefaultProductZoneStructureMap(baseZone())
    legacy['7'] = { ...legacy['7']!, columns: 2, rows: 4, gapHorizontal: 6 }
    const maps = normalizeProductZoneStructureMapByPreviewFormat(undefined, baseZone(), legacy)

    expect(maps.feed['7']).toMatchObject({ columns: 2, rows: 4, gapHorizontal: 6 })
    expect(maps.story['7']).toMatchObject({ columns: 2, rows: 4, gapHorizontal: 6 })
    expect(maps.feed['7']).not.toBe(maps.story['7'])
    expect(maps.feed['7']?.cardAspectRatios).not.toBe(maps.story['7']?.cardAspectRatios)
  })

  it('mantem receitas e variacoes diferentes em cada formato', () => {
    const maps = createDefaultProductZoneStructureMapByPreviewFormat(baseZone())
    maps.feed['7'] = { ...maps.feed['7']!, columns: 3, rows: 3 }
    maps.story['7'] = { ...maps.story['7']!, columns: 1, rows: 7, layoutDirection: 'vertical' }
    const variants = normalizeProductZoneStructureVariantMapByPreviewFormat(
      undefined,
      baseZone(),
      maps
    )
    const zone = baseZone({
      structureByProductCountByPreviewFormat: maps,
      structureVariantsByProductCountByPreviewFormat: variants
    })

    expect(resolveProductZoneStructure(zone, 7, 'feed')).toMatchObject({ columns: 3, rows: 3 })
    expect(resolveProductZoneStructure(zone, 7, 'story')).toMatchObject({ columns: 1, rows: 7, layoutDirection: 'vertical' })
    expect(variants.feed['7']).not.toBe(variants.story['7'])
  })

  it('identifica o preset mais proximo pelo tamanho real da pagina', () => {
    expect(getProductZonePreviewFormatForDimensions(1080, 1920)).toBe('story')
    expect(getProductZonePreviewFormatForDimensions(1080, 1350)).toBe('feed')
    expect(getProductZonePreviewFormatForDimensions(1080, 1080)).toBe('post')
    expect(getProductZonePreviewFormatForDimensions(1920, 1080)).toBe('banner')
    expect(getProductZonePreviewFormatForDimensions(2480, 3508)).toBe('a4')
  })
})
