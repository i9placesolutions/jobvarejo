import { describe, expect, it } from 'vitest'
import { fillMaskHoles, floodExteriorMask, createStickerCoverage } from '~/utils/stickerOutline'

const maskFromRows = (rows: string[]): Uint8Array => {
  return Uint8Array.from(rows.join('').split('').map((cell) => cell === '1' ? 1 : 0))
}

describe('sticker outline masks', () => {
  it('identifica o fundo conectado sem considerar o buraco interno como exterior', () => {
    const mask = maskFromRows([
      '00000',
      '01110',
      '01010',
      '01110',
      '00000'
    ])

    const exterior = floodExteriorMask(mask, 5, 5)

    expect(exterior[0]).toBe(1)
    expect(exterior[12]).toBe(0)
  })

  it('preenche o buraco fechado sem alterar a máscara original', () => {
    const mask = maskFromRows([
      '00000',
      '01110',
      '01010',
      '01110',
      '00000'
    ])

    const filled = fillMaskHoles(mask, 5, 5)

    expect(filled[12]).toBe(1)
    expect(mask[12]).toBe(0)
    expect(filled[0]).toBe(0)
  })

  // Distancias de referencia por busca exaustiva, independente da EDT usada
  // em producao. Detecta as frestas que as antigas mascaras introduziam.
  const distances = (mask: Uint8Array, width: number, inside = false) => Float32Array.from(mask, (_, i) => {
    let nearest = Infinity
    mask.forEach((value, j) => {
      if (inside ? !value : value) nearest = Math.min(nearest, (i % width - j % width) ** 2 + (Math.floor(i / width) - Math.floor(j / width)) ** 2)
    })
    return nearest
  })

  it('mantem cobertura continua da imagem ate a borda, sem um segundo anel', () => {
    const mask = new Uint8Array(21 * 21)
    mask[10 * 21 + 10] = 1
    const coverage = createStickerCoverage(mask, distances(mask, 21), 21, 21, 4, 2)
    expect(coverage[220]).toBe(1)
    for (let x = 10; x < 20; x++) {
      expect(coverage[10 * 21 + x]).toBeGreaterThanOrEqual(coverage[10 * 21 + x + 1]!)
    }
    expect(coverage[10 * 21 + 13]).toBe(1)
    expect(coverage[10 * 21 + 16]).toBe(0)
  })

  it('preenche o interior do adesivo e une detalhes proximos sem frestas', () => {
    const mask = maskFromRows(['000000000','001111100','001000100','001000100','001111100','000000000'])
    const coverage = createStickerCoverage(mask, distances(mask, 9), 9, 6, 1, 1)
    expect(coverage[2 * 9 + 4]).toBe(1)
    expect(coverage[1 * 9 + 4]).toBe(1)
    expect(coverage[2 * 9 + 1]).toBe(1)
  })

  it('nao pinta fora da imagem no modo interno', () => {
    const mask = maskFromRows(['00000','01110','01110','01110','00000'])
    const coverage = createStickerCoverage(mask, distances(mask, 5, true), 5, 5, 1, 1, 'inside')
    coverage.forEach((alpha, i) => { if (!mask[i]) expect(alpha).toBe(0) })
    expect(coverage[6]).toBe(1)
    expect(coverage[12]).toBe(0)
  })

  it('nao cria adesivo para uma imagem vazia', () => {
    const mask = new Uint8Array(25)
    expect(Array.from(createStickerCoverage(mask, distances(mask, 5), 5, 5, 4, 1))).toEqual(Array(25).fill(0))
  })

  it('retorna uma máscara vazia para dimensões inválidas', () => {
    expect(fillMaskHoles(new Uint8Array([1]), 0, 2)).toHaveLength(0)
    expect(floodExteriorMask(new Uint8Array([1]), 2, 2)).toEqual(new Uint8Array(4))
  })
})
