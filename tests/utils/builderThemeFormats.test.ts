import { describe, expect, it } from 'vitest'
import {
  builderThemeFormatSummary,
  builderThemeSupportsModel,
  normalizeBuilderThemeModelIds,
} from '~/utils/builderThemeFormats'

describe('builderThemeFormats', () => {
  const models = [
    { id: 'social', name: 'Feed Facebook' },
    { id: 'story', name: 'Stories' },
    { id: 'tv', name: 'TV Horizontal' },
  ]

  it('normaliza ids, remove vazios e preserva apenas uma ocorrência', () => {
    expect(normalizeBuilderThemeModelIds([' social ', '', 'social', null, 'story'])).toEqual(['social', 'story'])
  })

  it('trata tema legado ou marcado como todos como compatível com qualquer formato', () => {
    expect(builderThemeSupportsModel({ model_ids: [] }, 'story')).toBe(true)
    expect(builderThemeSupportsModel({}, 'tv')).toBe(true)
    expect(builderThemeSupportsModel({ model_ids: [] }, null)).toBe(true)
  })

  it('filtra um tema restrito ao formato selecionado', () => {
    expect(builderThemeSupportsModel({ model_ids: ['social', 'story'] }, 'story')).toBe(true)
    expect(builderThemeSupportsModel({ model_ids: ['social', 'story'] }, 'tv')).toBe(false)
  })

  it('resume os formatos usando os nomes do catálogo', () => {
    expect(builderThemeFormatSummary({ model_ids: [] }, models)).toBe('Todos os formatos')
    expect(builderThemeFormatSummary({ model_ids: ['social', 'story'] }, models)).toBe('Feed Facebook · Stories')
    expect(builderThemeFormatSummary({ model_ids: ['social', 'story', 'tv'] }, models)).toBe('Feed Facebook · Stories +1')
  })
})
