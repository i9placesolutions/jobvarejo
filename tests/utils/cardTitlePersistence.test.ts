import { describe, it, expect } from 'vitest'
import {
  getRenderedTextboxLinesForPersistence,
  buildPersistedCardTitleText
} from '~/utils/cardTitlePersistence'

describe('getRenderedTextboxLinesForPersistence', () => {
  it('non-textbox → []', () => {
    expect(getRenderedTextboxLinesForPersistence({ type: 'text' })).toEqual([])
    expect(getRenderedTextboxLinesForPersistence({ type: 'i-text' })).toEqual([])
    expect(getRenderedTextboxLinesForPersistence(null)).toEqual([])
  })

  it('le textLines (publica) preferencialmente', () => {
    const obj = {
      type: 'textbox',
      textLines: ['linha1', 'linha2'],
      _textLines: ['ignorado']
    }
    expect(getRenderedTextboxLinesForPersistence(obj)).toEqual(['linha1', 'linha2'])
  })

  it('cai para _textLines quando textLines ausente', () => {
    const obj = {
      type: 'textbox',
      _textLines: ['linha1', 'linha2']
    }
    expect(getRenderedTextboxLinesForPersistence(obj)).toEqual(['linha1', 'linha2'])
  })

  it('flatten string[][] (textLines com chars individuais)', () => {
    const obj = {
      type: 'textbox',
      textLines: [['h', 'i'], ['ok']]
    }
    expect(getRenderedTextboxLinesForPersistence(obj)).toEqual(['hi', 'ok'])
  })

  it('remove \\r de cada linha (legacy CRLF)', () => {
    const obj = {
      type: 'textbox',
      textLines: ['a\r', '\rb']
    }
    expect(getRenderedTextboxLinesForPersistence(obj)).toEqual(['a', 'b'])
  })

  it('chama initDimensions() se disponivel', () => {
    let initCalled = 0
    const obj = {
      type: 'textbox',
      textLines: ['a'],
      initDimensions() { initCalled += 1 }
    }
    getRenderedTextboxLinesForPersistence(obj)
    expect(initCalled).toBe(1)
  })

  it('filtra linhas vazias do meio mas preserva ultima vazia', () => {
    const obj = {
      type: 'textbox',
      textLines: ['a', '', 'b']
    }
    expect(getRenderedTextboxLinesForPersistence(obj)).toEqual(['a', '', 'b'])
  })

  it('linha unica vazia: preserva (single line case)', () => {
    const obj = {
      type: 'textbox',
      textLines: ['']
    }
    expect(getRenderedTextboxLinesForPersistence(obj)).toEqual([''])
  })

  it('case insensitive em type=textbox', () => {
    expect(getRenderedTextboxLinesForPersistence({ type: 'Textbox', textLines: ['x'] }))
      .toEqual(['x'])
    expect(getRenderedTextboxLinesForPersistence({ type: 'TEXTBOX', textLines: ['x'] }))
      .toEqual(['x'])
  })
})

describe('buildPersistedCardTitleText', () => {
  it('texto com \\n preservado como esta', () => {
    expect(buildPersistedCardTitleText({ text: 'linha1\nlinha2' }))
      .toBe('linha1\nlinha2')
  })

  it('CRLF (\\r\\n) normalizado para \\n', () => {
    expect(buildPersistedCardTitleText({ text: 'linha1\r\nlinha2' }))
      .toBe('linha1\nlinha2')
  })

  it('CR sozinho (\\r) normalizado para \\n', () => {
    expect(buildPersistedCardTitleText({ text: 'linha1\rlinha2' }))
      .toBe('linha1\nlinha2')
  })

  it('texto single-line + textbox sem wrap: retorna raw', () => {
    const obj = { type: 'textbox', text: 'simples', textLines: ['simples'] }
    expect(buildPersistedCardTitleText(obj)).toBe('simples')
  })

  it('texto single-line + textbox COM word-wrap: junta linhas', () => {
    const obj = {
      type: 'textbox',
      text: 'banana caramelizada',
      textLines: ['banana', 'caramelizada']
    }
    expect(buildPersistedCardTitleText(obj)).toBe('banana\ncaramelizada')
  })

  it('texto vazio → ""', () => {
    expect(buildPersistedCardTitleText({})).toBe('')
    expect(buildPersistedCardTitleText({ text: null })).toBe('')
    expect(buildPersistedCardTitleText({ text: undefined })).toBe('')
  })

  it('non-textbox sem \\n: retorna raw mesmo (sem texLines)', () => {
    expect(buildPersistedCardTitleText({ type: 'text', text: 'foo' })).toBe('foo')
  })

  it('linhas vazias do textbox sao ignoradas no merge', () => {
    const obj = {
      type: 'textbox',
      text: 'a b',
      textLines: ['a', '', 'b']
    }
    expect(buildPersistedCardTitleText(obj)).toBe('a\nb')
  })

  it('apenas 1 linha rendered: retorna texto raw (nao adiciona \\n)', () => {
    const obj = { type: 'textbox', text: 'simples', textLines: ['simples'] }
    expect(buildPersistedCardTitleText(obj)).toBe('simples')
  })
})
