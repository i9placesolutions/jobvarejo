import { describe, expect, it } from 'vitest'
import {
  LABEL_TEMPLATE_NAME_MAX_LENGTH,
  normalizeLabelTemplateName
} from '~/utils/labelTemplateHelpers'

describe('normalizeLabelTemplateName', () => {
  it('usa fallback para nome vazio e remove espaços laterais', () => {
    expect(normalizeLabelTemplateName('   ', 'Meu modelo')).toBe('Meu modelo')
    expect(normalizeLabelTemplateName('  Oferta  ', 'Etiqueta')).toBe('Oferta')
  })

  it('limita nomes gerados por duplicação ao limite da API', () => {
    const name = normalizeLabelTemplateName(`${'a'.repeat(120)} (cópia)`, 'Etiqueta')
    expect(name).toHaveLength(LABEL_TEMPLATE_NAME_MAX_LENGTH)
  })
})
