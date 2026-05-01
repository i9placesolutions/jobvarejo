import { describe, it, expect } from 'vitest'
import { computeArrangedOrder } from '~/utils/arrangeOrder'

describe('computeArrangedOrder', () => {
  // Lista [a, b, c, d] onde selected={b}; entendendo "topo do Z-order" = ultimo
  const a = { id: 'a' }
  const b = { id: 'b' }
  const c = { id: 'c' }
  const d = { id: 'd' }

  it('lista vazia retorna copia vazia', () => {
    expect(computeArrangedOrder([], new Set(), 'bring-to-front')).toEqual([])
  })

  it('um unico elemento: retorna copia', () => {
    const r = computeArrangedOrder([a], new Set([a]), 'bring-to-front')
    expect(r).toEqual([a])
    expect(r).not.toBe([a]) // copia, nao mesma ref
  })

  it('bring-to-front: move selecionados para o fim', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([b]), 'bring-to-front'))
      .toEqual([a, c, d, b])
  })

  it('bring-to-front: multiplos selecionados preservam ordem relativa', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([a, c]), 'bring-to-front'))
      .toEqual([b, d, a, c])
  })

  it('send-to-back: move selecionados para o inicio', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([d]), 'send-to-back'))
      .toEqual([d, a, b, c])
  })

  it('send-to-back: multiplos selecionados preservam ordem relativa', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([b, d]), 'send-to-back'))
      .toEqual([b, d, a, c])
  })

  it('bring-forward: troca selecionado UM passo a frente', () => {
    // b vai pra posicao de c
    expect(computeArrangedOrder([a, b, c, d], new Set([b]), 'bring-forward'))
      .toEqual([a, c, b, d])
  })

  it('bring-forward: NAO troca quando vizinho da frente tambem e selecionado', () => {
    // Loop iterativo de tras pra frente: c avanca primeiro [a,b,d,c],
    // depois b ve d a frente (nao selecionado) e tambem avanca: [a,d,b,c].
    // Nenhum selecionado fica preso por outro selecionado.
    expect(computeArrangedOrder([a, b, c, d], new Set([b, c]), 'bring-forward'))
      .toEqual([a, d, b, c])
  })

  it('bring-forward: ja no topo nao muda', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([d]), 'bring-forward'))
      .toEqual([a, b, c, d])
  })

  it('send-backward: troca selecionado UM passo para tras', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([c]), 'send-backward'))
      .toEqual([a, c, b, d])
  })

  it('send-backward: ja no fundo nao muda', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set([a]), 'send-backward'))
      .toEqual([a, b, c, d])
  })

  it('REGRESSAO: nao muta o input', () => {
    const list = [a, b, c, d]
    const original = list.slice()
    computeArrangedOrder(list, new Set([b]), 'bring-to-front')
    expect(list).toEqual(original)
  })

  it('Set vazio: nada se move', () => {
    expect(computeArrangedOrder([a, b, c, d], new Set(), 'bring-to-front'))
      .toEqual([a, b, c, d])
  })
})
