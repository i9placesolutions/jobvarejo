import { describe, expect, it } from 'vitest'
import { chooseHistoryViewportTransform } from '~/utils/editorHistoryApply'

describe('chooseHistoryViewportTransform', () => {
  it('preserva o viewport atual durante undo/redo', () => {
    expect(
      chooseHistoryViewportTransform(
        [0.42, 0, 0, 0.42, 380, 120],
        [1, 0, 0, 1, 0, 0]
      )
    ).toEqual([0.42, 0, 0, 0.42, 380, 120])
  })

  it('usa viewport salvo apenas quando o viewport atual nao existe', () => {
    expect(
      chooseHistoryViewportTransform(
        null,
        [0.65, 0, 0, 0.65, 40, 80]
      )
    ).toEqual([0.65, 0, 0, 0.65, 40, 80])
  })

  it('ignora escala invalida e retorna null quando nao ha fallback seguro', () => {
    expect(
      chooseHistoryViewportTransform(
        [0, 0, 0, 0, 0, 0],
        [Infinity, 0, 0, 1, 0, 0]
      )
    ).toBeNull()
  })

  it('rejeita escala fora do limite operacional do editor', () => {
    expect(
      chooseHistoryViewportTransform(
        [100, 0, 0, 100, 0, 0],
        [0.5, 0, 0, 0.5, 0, 0]
      )
    ).toEqual([0.5, 0, 0, 0.5, 0, 0])
  })
})
