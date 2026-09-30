import { describe, expect, it } from 'vitest'
import { assertRenderTheme } from '../../workers/video-studio/render-theme.mjs'

describe('validação do catálogo de temas no renderizador', () => {
  const catalog = [
    { id: 'fresh', name: 'Tema clássico' },
    { id: 'flyer-2536b8a4-5773-4b5f-8946-3caf3492937e', name: 'Receita de encarte' }
  ]

  it('aceita tema clássico e receita quando ambos existem no catálogo', () => {
    expect(assertRenderTheme('fresh', catalog)).toBe('fresh')
    expect(assertRenderTheme('flyer-2536b8a4-5773-4b5f-8946-3caf3492937e', catalog))
      .toBe('flyer-2536b8a4-5773-4b5f-8946-3caf3492937e')
  })

  it.each(['tema-desconhecido', undefined, null, ''])('rejeita tema ausente ou desconhecido (%s)', theme => {
    expect(() => assertRenderTheme(theme, catalog)).toThrow(/não está disponível neste renderizador/)
  })
})
