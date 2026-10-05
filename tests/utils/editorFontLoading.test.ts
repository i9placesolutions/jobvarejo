import { describe, expect, it, vi } from 'vitest'
import { collectEditorWebFonts, createEditorFontLoader } from '../../utils/editorFontLoading'

describe('fontes usadas na arte', () => {
  it('coleta filhos e estilos por caractere sem carregar fontes ausentes', () => {
    const child = { type: 'Textbox', fontFamily: 'Montserrat', fontWeight: 800, styles: { 0: { 1: { fontWeight: 700, fontStyle: 'italic' }, 2: { fontFamily: 'Arial' } } } }
    expect(collectEditorWebFonts({ objects: [{ type: 'Group', getObjects: () => [child] }, { type: 'Text', fontFamily: 'Barlow', fontWeight: 'bold' }] })).toEqual(['Barlow:700', 'Montserrat:700italic,800'])
    expect(child.fontWeight).toBe(800)
  })
  it('preserva fontes externas/sistema e usa apenas variantes suportadas', () => {
    expect(collectEditorWebFonts([{ type: 'text', fontFamily: 'Minha Fonte' }, { type: 'text', fontFamily: 'Anton', fontWeight: 900 }])).toEqual(['Anton:400'])
    expect(collectEditorWebFonts({ objects: [] })).toEqual([])
  })
  it('carrega Barlow Condensed nos pesos definidos no catálogo', () => {
    expect(collectEditorWebFonts([{ type: 'text', fontFamily: 'Barlow Condensed', fontWeight: 800 }]))
      .toEqual(['Barlow Condensed:800'])
    expect(collectEditorWebFonts([{ type: 'text', fontFamily: 'Barlow Condensed', fontWeight: 800, fontStyle: 'italic' }]))
      .toEqual(['Barlow Condensed:800italic'])
  })
  it('não duplica variantes pendentes e carrega uma nova variante sob demanda', async () => {
    let release!: () => void
    const load = vi.fn((_families: string[]) => new Promise<void>(resolve => { release = resolve }))
    const fonts = createEditorFontLoader(load)
    const first = fonts(['Barlow:400,700'])
    const second = fonts(['Barlow:700'])
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(1)
    release(); await Promise.all([first, second])
    await fonts(['Barlow:400'])
    expect(load).toHaveBeenCalledTimes(1)
    const third = fonts(['Barlow:900'])
    await Promise.resolve(); release(); await third
    expect(load.mock.calls[1]![0]).toEqual(['Barlow:900'])
  })
  it('falhas não impedem uma nova tentativa', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(undefined)
    const fonts = createEditorFontLoader(load)
    await expect(fonts(['Barlow:700'])).rejects.toThrow('rede')
    await fonts(['Barlow:700'])
    expect(load).toHaveBeenCalledTimes(2)
  })
})
