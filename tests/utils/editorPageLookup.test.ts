import { describe, it, expect } from 'vitest'
import { findPageIndexById } from '~/utils/editorPageLookup'

describe('findPageIndexById — busca pagina respeitando active hint', () => {
  const pages = [
    { id: 'page-a', name: 'Frente' },
    { id: 'page-b', name: 'Verso' },
    { id: 'page-c', name: 'Encarte' }
  ]

  it('retorna -1 para entradas invalidas', () => {
    expect(findPageIndexById([], 'page-a')).toBe(-1)
    expect(findPageIndexById(pages, '')).toBe(-1)
    expect(findPageIndexById(pages, '   ')).toBe(-1)
    expect(findPageIndexById(null as any, 'page-a')).toBe(-1)
  })

  it('encontra pagina por id', () => {
    expect(findPageIndexById(pages, 'page-a')).toBe(0)
    expect(findPageIndexById(pages, 'page-b')).toBe(1)
    expect(findPageIndexById(pages, 'page-c')).toBe(2)
  })

  it('normaliza espacos no id', () => {
    expect(findPageIndexById(pages, '  page-b  ')).toBe(1)
  })

  it('retorna -1 quando id nao existe', () => {
    expect(findPageIndexById(pages, 'page-z')).toBe(-1)
  })

  it('atalho de active hint: usa indice quando bate', () => {
    // hint correto evita findIndex linear
    expect(findPageIndexById(pages, 'page-b', 1)).toBe(1)
  })

  it('hint invalido cai no findIndex linear normal', () => {
    expect(findPageIndexById(pages, 'page-b', 99)).toBe(1)
    expect(findPageIndexById(pages, 'page-b', -1)).toBe(1)
    expect(findPageIndexById(pages, 'page-b', NaN)).toBe(1)
  })

  it('hint para pagina com id divergente é ignorado', () => {
    // hint=0 mas id procurado é page-b → ignora hint e busca normal
    expect(findPageIndexById(pages, 'page-b', 0)).toBe(1)
  })
})
