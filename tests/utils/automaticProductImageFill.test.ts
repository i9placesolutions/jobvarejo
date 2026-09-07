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
