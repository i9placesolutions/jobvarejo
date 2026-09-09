import { describe, expect, it } from 'vitest'
import {
  getFlyerTemplateCategoryKey,
  getFlyerTemplateCategory,
  normalizeFlyerTemplateCategory,
  normalizeFlyerTemplateConfigCategory
} from '~/utils/flyerTemplateCategory'

describe('flyerTemplateCategory', () => {
  it('normaliza espaços e limita a categoria a um rótulo curto', () => {
    expect(normalizeFlyerTemplateCategory('  Fim\n de   semana  ')).toBe('Fim de semana')
    expect(normalizeFlyerTemplateCategory('')).toBeNull()
    expect(normalizeFlyerTemplateCategory({ name: 'Limpeza' })).toBeNull()
    expect(normalizeFlyerTemplateCategory('x'.repeat(80))).toHaveLength(60)
    expect(getFlyerTemplateCategoryKey('  FIM\n de   semana ')).toBe('fim de semana')
  })

  it('lê e atualiza a categoria sem descartar a composição do modelo', () => {
    const config = {
      category: '  Hortifruti ',
      formatIds: ['feed'],
      models: [{ id: 'model-1', name: 'Semana verde' }]
    }

    expect(getFlyerTemplateCategory(config)).toBe('Hortifruti')
    expect(normalizeFlyerTemplateConfigCategory(config)).toEqual({
      category: 'Hortifruti',
      formatIds: ['feed'],
      models: [{ id: 'model-1', name: 'Semana verde' }]
    })
    expect(normalizeFlyerTemplateConfigCategory({ ...config, category: '   ' })).toEqual({
      formatIds: ['feed'],
      models: [{ id: 'model-1', name: 'Semana verde' }]
    })
  })
})
