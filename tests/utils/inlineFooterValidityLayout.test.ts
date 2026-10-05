import { expect, it } from 'vitest'
import { layoutInlineFooterValidity } from '../../utils/inlineFooterValidityLayout'

const object = (values: Record<string, any>) => ({
  left: 0, top: 0, width: 40, height: 40, scaleX: 1, scaleY: 1, parentFrameId: 'f', ...values,
  set(patch: any) { Object.assign(this, patch) }, setCoords() {},
  getBoundingRect() { return { left: this.left, top: this.top, width: this.width, height: this.height } }
})

const textbox = (text: string, fontSize = 26) => object({
  quickValidityLayout: 'inline-footer', text, fontSize, dynamicFieldBaseFontSize: fontSize, textLines: [],
  initDimensions() {
    const words = String(this.text).split(' ')
    const maxChars = Math.max(1, Math.floor(this.width / (this.fontSize * 0.55)))
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (line && next.length > maxChars) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line || !lines.length) lines.push(line)
    this.textLines = lines
    this.height = lines.length * this.fontSize * 1.13
  },
  calcTextWidth() { return Math.max(0, ...this.textLines.map((line: string) => line.length * this.fontSize * 0.55)) },
  getLineWidth(index: number) { return (this.textLines[index] || '').length * this.fontSize * 0.55 }
})

const setup = (date: any, bandWidth = 1920, bandHeight = 72) => {
  const icon = object({ name: 'header-validity-calendar', left: 34, width: 40, height: 40 })
  const band = object({ name: 'standard-validity-background', width: bandWidth, height: bandHeight, top: 1008, left: 0 })
  return { date, icon, objects: [date, icon, band] }
}

it('mantém uma linha, preserva o texto e centraliza o conjunto após trocar a validade', () => {
  const date: any = textbox('OFERTA VÁLIDA HOJE')
  const { icon, objects } = setup(date)
  const texts = [
    'OFERTA VÁLIDA HOJE',
    'OFERTAS VÁLIDAS DE 30 DE DEZEMBRO DE 2026 A 2 DE JANEIRO DE 2027 OU ENQUANTO DURAREM OS ESTOQUES',
    'OFERTA VÁLIDA '.repeat(30).trim()
  ]

  for (const text of texts) {
    date.text = text
    layoutInlineFooterValidity(objects)
    expect(date.text).toBe(text)
    expect(date.textLines).toHaveLength(1)
    expect(date.height).toBeLessThanOrEqual(72 - 12 + 0.5)
    expect(date.left - (icon.left + icon.width)).toBeCloseTo(16)
    expect((icon.left + date.left + date.calcTextWidth()) / 2).toBeCloseTo(960)
    expect(date.left + date.width).toBeLessThanOrEqual(1896 + 0.01)
    expect(layoutInlineFooterValidity(objects)).toBe(false)
  }
})

it('reduz a fonte até a frase longa caber em uma linha dentro da cápsula', () => {
  const text = 'OFERTA VÁLIDA DE 5 A 6 DE OUTUBRO OU ENQUANTO DURAREM OS ESTOQUES'
  const date: any = textbox(text)
  const { icon, objects } = setup(date, 840, 42)

  expect(layoutInlineFooterValidity(objects)).toBe(true)

  expect(date.text).toBe(text)
  expect(date.textLines).toHaveLength(1)
  expect(date.fontSize).toBeLessThan(26)
  expect(date.calcTextWidth()).toBeLessThanOrEqual(date.width)
  expect(date.height).toBeLessThanOrEqual(42 - 12 * 840 / 1920 + 0.5)
  expect(date.left - (icon.left + icon.width)).toBeCloseTo(16 * 840 / 1920)
  expect((icon.left + date.left + date.calcTextWidth()) / 2).toBeCloseTo(420)
  expect(layoutInlineFooterValidity(objects)).toBe(false)
})
