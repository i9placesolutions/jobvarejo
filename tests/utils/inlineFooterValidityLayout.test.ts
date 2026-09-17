import { expect, it } from 'vitest'
import { layoutInlineFooterValidity } from '../../utils/inlineFooterValidityLayout'
const object = (values: Record<string, any>) => ({
 left: 0, top: 0, width: 40, height: 40, scaleX: 1, scaleY: 1, parentFrameId: 'f', ...values,
 set(patch: any) { Object.assign(this, patch) }, setCoords() {},
 getBoundingRect() { return { left: this.left, top: this.top, width: this.width, height: this.height } }
})
it('mantém o ícone junto ao texto e centraliza o conjunto após trocar a data', () => {
 const date: any = object({ quickValidityLayout: 'inline-footer', text: 'OFERTA VÁLIDA HOJE', fontSize: 26, dynamicFieldBaseFontSize: 26,
 initDimensions() { this.height = this.fontSize * 1.13 }, calcTextWidth() { return this.text.length * this.fontSize * .55 } })
 const icon = object({ name: 'header-validity-calendar', left: 34 })
 const band = object({ name: 'standard-validity-background', width: 1920, height: 72, top: 1008 })
 const objects = [date, icon, band]
 for (const text of ['OFERTA VÁLIDA HOJE', 'OFERTAS VÁLIDAS DE 30 DE DEZEMBRO DE 2026 A 2 DE JANEIRO DE 2027 OU ENQUANTO DURAREM OS ESTOQUES', 'X'.repeat(500)]) {
  date.text = text
  layoutInlineFooterValidity(objects)
  expect(date.left - (icon.left + icon.width)).toBeCloseTo(16)
  expect((icon.left + date.left + date.width) / 2).toBeCloseTo(960)
  expect(date.left + date.width).toBeLessThanOrEqual(1896)
  expect(layoutInlineFooterValidity(objects)).toBe(false)
 }
})
