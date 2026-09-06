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
