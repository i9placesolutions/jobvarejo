import { describe, expect, it } from 'vitest'
import { createDefaultProductZoneStructureMapByPreviewFormat, getProductZoneStructureLibraryPatch, resolveProductZoneStructure } from '~/utils/product-zone-structure'

describe('receita atual na importação da edição rápida', () => {
  it('usa a configuração de 13 produtos do formato atual sem mudar outras receitas ou a biblioteca', () => {
    const stored = createDefaultProductZoneStructureMapByPreviewFormat()
    const library = createDefaultProductZoneStructureMapByPreviewFormat()
    const format = 'post' as const
    library[format]['13'] = { ...library[format]['13']!, columns: 5, rows: 3 }
    const zone = { structureByProductCountByPreviewFormat: stored }
    const patch = getProductZoneStructureLibraryPatch(zone, library, {} as any, 13, format)
    expect(resolveProductZoneStructure({ ...zone, ...patch }, 13, format)?.columns).toBe(5)
    expect(patch.structureByProductCountByPreviewFormat?.[format]['12']).toEqual(stored[format]['12'])
    expect(zone.structureByProductCountByPreviewFormat).toEqual(stored)
    patch.structureByProductCount!["13"]!.columns = 2
    expect(library[format]['13']?.columns).toBe(5)
  })

  it('mantém a variante configurada entre opções atualizadas para 13 produtos', () => {
    const library = createDefaultProductZoneStructureMapByPreviewFormat()
    const recipe = { ...library.post['13']!, id: 'custom-13', name: 'Minha grade', columns: 5, rows: 3 }
    const zone = { structureVariantByProductCount: { '13': 'custom-13' } }
    const patch = getProductZoneStructureLibraryPatch(zone, library, { post: { '13': [recipe] } } as any, 13, 'post')
    expect(resolveProductZoneStructure({ ...zone, ...patch }, 13, 'post')?.columns).toBe(5)
  })
})
