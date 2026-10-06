import { expect, it } from 'vitest'
import { planAutomaticProductImageFill } from '../../utils/automaticProductImageFill'
it('mantém cópias lado a lado na mesma linha e dentro do card', () => {
  for (const count of [2, 3, 4]) {
    const plan = planAutomaticProductImageFill(300, 210, 100, 180, count, 'horizontal')
    expect(plan).toHaveLength(count)
    expect(new Set(plan.map(image => image.top)).size).toBe(1)
    for (const image of plan) {
      expect(Math.abs(image.left) + 50 * image.scale).toBeLessThanOrEqual(150.001)
      expect(Math.abs(image.top) + 90 * image.scale).toBeLessThanOrEqual(105.001)
    }
  }
})
it('preenche o card estreito com cópias verticais alinhadas e na largura máxima', () => {
  const plan = planAutomaticProductImageFill(94, 204, 200, 100)
  expect(plan).toHaveLength(4)
  expect(new Set(plan.map(image => image.left)).size).toBe(1)
  expect(plan[0]!.scale * 200).toBeCloseTo(94)
  const height = Math.max(...plan.map(image => image.top + 50 * image.scale)) - Math.min(...plan.map(image => image.top - 50 * image.scale))
  expect(height).toBeGreaterThan(180)
  for (const image of plan) {
    expect(Math.abs(image.left) + 100 * image.scale).toBeLessThanOrEqual(47.001)
    expect(Math.abs(image.top) + 50 * image.scale).toBeLessThanOrEqual(102.001)
  }
})
it('desenha a pilha de cima para baixo para as cópias inferiores ficarem à frente', () => {
  const plan = planAutomaticProductImageFill(200, 380, 200, 150, 4, 'vertical')
  expect(plan).toHaveLength(4)
  for (let index = 1; index < plan.length; index++) {
    expect(plan[index]!.top).toBeGreaterThan(plan[index - 1]!.top)
    expect(plan[index]!.top - plan[index - 1]!.top).toBeLessThan(150 * plan[index]!.scale)
    expect(plan[index]!.left).toBeCloseTo(plan[0]!.left)
    expect(plan[index]!.scale).toBe(plan[0]!.scale)
  }
})
it('mantém duas fotos grandes e pareadas na área configurada em Cards', () => {
  const plan = planAutomaticProductImageFill(426, 448, 512, 415, 2)
  expect(plan).toHaveLength(2)
  expect(plan[0]!.left).toBeCloseTo(plan[1]!.left)
  expect(plan[1]!.top).toBeGreaterThan(plan[0]!.top)
  expect(plan[0]!.scale * 512).toBeCloseTo(426)
  for (const image of plan) {
    expect(Math.abs(image.left) + 256 * image.scale).toBeLessThanOrEqual(213.001)
    expect(Math.abs(image.top) + 207.5 * image.scale).toBeLessThanOrEqual(224.001)
  }
})
it('usa a sobra horizontal para manter escala máxima de uma imagem retrato', () => {
  const plan = planAutomaticProductImageFill(300, 400, 200, 400, 2)
  expect(plan).toHaveLength(2)
  expect(plan[0]!.scale).toBe(1)
  expect(plan[0]!.top).toBeCloseTo(plan[1]!.top)
  expect(plan[1]!.left).toBeGreaterThan(plan[0]!.left)
  for (const image of plan) {
    expect(Math.abs(image.left) + 100 * image.scale).toBeLessThanOrEqual(150.001)
    expect(Math.abs(image.top) + 200 * image.scale).toBeLessThanOrEqual(200.001)
  }
})
it('respeita a direção pedida mesmo quando isso exige reduzir a escala', () => {
  const plan = planAutomaticProductImageFill(426, 448, 512, 415, 2, 'horizontal')
  expect(plan).toHaveLength(2)
  expect(plan[0]!.top).toBeCloseTo(plan[1]!.top)
  expect(plan[1]!.left).toBeGreaterThan(plan[0]!.left)
  expect(plan[0]!.scale).toBeLessThan(426 / 512)
  for (const image of plan) {
    expect(Math.abs(image.left) + 256 * image.scale).toBeLessThanOrEqual(213.001)
    expect(Math.abs(image.top) + 207.5 * image.scale).toBeLessThanOrEqual(224.001)
  }
})
it('respeita a direção vertical explícita e preserva a escala quando há sobra', () => {
  const plan = planAutomaticProductImageFill(426, 448, 512, 415, 2, 'vertical')
  expect(plan).toHaveLength(2)
  expect(plan[0]!.left).toBeCloseTo(plan[1]!.left)
  expect(plan[1]!.top).toBeGreaterThan(plan[0]!.top)
  expect(plan[0]!.scale * 512).toBeCloseTo(426)
  for (const image of plan) {
    expect(Math.abs(image.left) + 256 * image.scale).toBeLessThanOrEqual(213.001)
    expect(Math.abs(image.top) + 207.5 * image.scale).toBeLessThanOrEqual(224.001)
  }
})
it('reduz apenas o necessário para revelar a segunda cópia em uma área quadrada sem sobra', () => {
  const plan = planAutomaticProductImageFill(200, 200, 200, 200, 2)
  const minimumVisibleOffsetRatio = 0.18
  expect(plan).toHaveLength(2)
  expect(plan[0]!.scale).toBeCloseTo(1 / (1 + minimumVisibleOffsetRatio))
  expect(plan[0]!.top).toBeCloseTo(plan[1]!.top)
  expect(plan[1]!.left - plan[0]!.left).toBeCloseTo(200 * plan[0]!.scale * minimumVisibleOffsetRatio)
  expect(plan[1]!.left).toBeGreaterThan(plan[0]!.left)
  for (const image of plan) {
    expect(Math.abs(image.left) + 100 * image.scale).toBeLessThanOrEqual(100.001)
    expect(Math.abs(image.top) + 100 * image.scale).toBeLessThanOrEqual(100.001)
  }
})
it('abandona duas cópias quando o novo espaço pede uma imagem', () => {
  const before = planAutomaticProductImageFill(200, 400, 100, 100)
  const after = planAutomaticProductImageFill(200, 200, 100, 100)
  expect(before.length).toBeGreaterThan(1)
  expect(after).toHaveLength(1)
  expect(after[0]).toEqual({ left: 0, top: 0, scale: 2 })
  expect(new Set(before.map(image => image.scale)).size).toBe(1)
})

it('mínimo automático mantém o par e acrescenta cópias quando a imagem larga deixa o card alto vazio', () => {
  const tall = planAutomaticProductImageFill(260, 380, 800, 520, undefined, 'auto', 2)
  expect(tall.length).toBe(3)
  // As cópias extremas encostam nas bordas da área, sem faixa vazia no topo.
  expect(tall[0]!.top - 520 * tall[0]!.scale / 2).toBeCloseTo(-190, 0)
  expect(tall.at(-1)!.top + 520 * tall.at(-1)!.scale / 2).toBeCloseTo(190, 0)

  // Onde o automático escolheria uma única imagem, o mínimo preserva o par.
  const wide = planAutomaticProductImageFill(400, 300, 800, 520, undefined, 'auto', 2)
  expect(wide).toEqual(planAutomaticProductImageFill(400, 300, 800, 520, 2, 'auto'))
})
