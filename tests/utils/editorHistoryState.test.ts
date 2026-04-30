import { describe, it, expect } from 'vitest'
import { appendHistoryEntry } from '~/utils/editorHistoryState'

describe('appendHistoryEntry — undo/redo state machine', () => {
  it('append em stack vazio cria primeiro entry', () => {
    const result = appendHistoryEntry({
      historyStack: [],
      historyIndex: -1,
      entry: 'state-1'
    })
    expect(result.didAppend).toBe(true)
    expect(result.historyStack).toEqual(['state-1'])
    expect(result.historyIndex).toBe(0)
  })

  it('detecta duplicata padrao (===) e nao acrescenta', () => {
    const result = appendHistoryEntry({
      historyStack: ['state-1'],
      historyIndex: 0,
      entry: 'state-1'
    })
    expect(result.didAppend).toBe(false)
    expect(result.historyStack).toEqual(['state-1'])
    expect(result.historyIndex).toBe(0)
  })

  it('isDuplicateEntry custom permite ignorar diffs irrelevantes', () => {
    const result = appendHistoryEntry({
      historyStack: ['{"v":1}'],
      historyIndex: 0,
      entry: '{"v":1,"_ts":12345}',
      isDuplicateEntry: (a, b) => {
        const stripTs = (s?: string) => s?.replace(/,?"_ts":\d+/, '') ?? ''
        return stripTs(a) === stripTs(b)
      }
    })
    expect(result.didAppend).toBe(false)
  })

  it('append em meio de stack trunca o futuro (linha do tempo unica)', () => {
    const result = appendHistoryEntry({
      historyStack: ['s1', 's2', 's3', 's4', 's5'],
      historyIndex: 2, // posicionado em s3
      entry: 'novo-after-s3'
    })
    expect(result.didAppend).toBe(true)
    expect(result.historyStack).toEqual(['s1', 's2', 's3', 'novo-after-s3'])
    expect(result.historyIndex).toBe(3)
  })

  it('respeita maxEntries (default 50) descartando entries antigas', () => {
    const stack = Array.from({ length: 50 }, (_, i) => `s${i}`)
    const result = appendHistoryEntry({
      historyStack: stack,
      historyIndex: 49,
      entry: 's50'
    })
    expect(result.historyStack.length).toBe(50)
    expect(result.historyStack[0]).toBe('s1') // s0 foi descartado
    expect(result.historyStack[49]).toBe('s50')
    expect(result.historyIndex).toBe(49)
  })

  it('respeita maxEntries customizado', () => {
    const result = appendHistoryEntry({
      historyStack: ['a', 'b', 'c'],
      historyIndex: 2,
      entry: 'd',
      maxEntries: 3
    })
    expect(result.historyStack).toEqual(['b', 'c', 'd'])
    expect(result.historyIndex).toBe(2)
  })

  it('historyIndex invalido (NaN/negativo extremo) cai no ultimo entry valido', () => {
    const result = appendHistoryEntry({
      historyStack: ['s1', 's2'],
      historyIndex: NaN,
      entry: 's3'
    })
    expect(result.didAppend).toBe(true)
    expect(result.historyStack).toEqual(['s1', 's2', 's3'])
  })

  it('append apos undo + nova edicao trunca o redo (comportamento esperado)', () => {
    // simula: estado atual em s2, usuario fez undo (chegou em s1), depois editou
    const result = appendHistoryEntry({
      historyStack: ['s1', 's2', 's3'],
      historyIndex: 0, // posicionado em s1 apos undos
      entry: 'novo-s2'
    })
    expect(result.historyStack).toEqual(['s1', 'novo-s2'])
    expect(result.historyIndex).toBe(1)
  })

  it('maxEntries=1 mantem so o ultimo (caso degenerado mas tolerado)', () => {
    const result = appendHistoryEntry({
      historyStack: ['old'],
      historyIndex: 0,
      entry: 'new',
      maxEntries: 1
    })
    expect(result.historyStack).toEqual(['new'])
    expect(result.historyIndex).toBe(0)
  })
})
