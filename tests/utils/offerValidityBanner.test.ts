import { describe, expect, it } from 'vitest'
import { layoutOfferValidityBanner } from '../../utils/offerValidityBanner'
import { repairDynamicTextLayoutBounds } from '../../utils/dynamicTextLayoutBounds'
import { resolveSplitFooterValidityText, splitFooterValidityText } from '../../utils/splitFooterValidity'

const object = (values: Record<string, any>): any => ({
  type: 'rect', left: 0, top: 0, width: 100, height: 20, scaleX: 1, scaleY: 1, strokeWidth: 0,
  visible: true, parentFrameId: 'f', ...values,
  set(patch: any) { Object.assign(this, patch) }, setCoords() {},
  getBoundingRect() { return { left: this.left, top: this.top, width: this.width * this.scaleX, height: this.height * this.scaleY } }
})
const text = (values: Record<string, any>) => object({
  type: 'textbox', fontSize: 30, text: '', styles: {}, ...values,
  calcTextWidth() { return this.text.length * this.fontSize * .55 },
  initDimensions() {
    const count = Math.max(1, Math.ceil(this.calcTextWidth() / this.width))
    this.textLines = Array.from({ length: count }, () => this.text)
    this.height = this.fontSize * 1.13 * count
  }
})
const fixture = (scale = 1) => {
  const frame = object({ isFrame: true, _customId: 'f', parentFrameId: undefined, width: 1080 * scale, height: 1350 * scale })
  const band = object({ name: 'standard-validity-background', left: 24 * scale, top: 300 * scale, width: 1032 * scale, height: 100 * scale, fill: '#a5200c', stroke: '#ffdd22' })
  const heading = text({ name: 'validity-heading', text: 'OFERTAS VÁLIDAS DE', fontSize: 23 * scale, fill: '#ffffff' })
  const date = text({ quickDataField: 'validity', quickValidityLayout: 'offer-banner', text: '18 A 20 DE SETEMBRO', fontSize: 34 * scale, fill: '#ffe000' })
  const stock = text({ name: 'stock-validity', text: 'OU ENQUANTO DURAREM OS ESTOQUES', fontSize: 16 * scale, fill: '#ffffff' })
  const zone = object({ isProductZone: true, top: 420 * scale, width: 1080 * scale, height: 780 * scale })
  return { objects: [frame, band, heading, date, stock, zone], band, heading, date, stock, zone }
}
const expectInside = (field: any, band: any) => {
  const b = field.getBoundingRect(), area = band.getBoundingRect()
  expect(b.left).toBeGreaterThan(area.left)
  expect(b.top).toBeGreaterThan(area.top)
  expect(b.left + b.width).toBeLessThan(area.left + area.width)
  expect(b.top + b.height).toBeLessThan(area.top + area.height)
  expect(field.textLines).toHaveLength(1)
}

describe('faixa de validade no cabeçalho', () => {
  it.each([1, 1.5, .6])('acomoda período e estoque no espaço reservado em escala %s', scale => {
    const { objects, band, heading, date, stock, zone } = fixture(scale)
    const geometry = JSON.stringify([band, zone])
    expect(layoutOfferValidityBanner(objects)).toBe(true)
    for (const field of [heading, date, stock]) expectInside(field, band)
    expect(heading.top + heading.height).toBeLessThan(date.top)
    expect(date.top + date.height).toBeLessThan(stock.top)
    expect(date.fontSize).toBeGreaterThan(heading.fontSize)
    expect(heading.fontSize).toBeGreaterThan(stock.fontSize)
    expect(date.fill).toBe('#ffe000')
    expect(band.fill).toBe('#a5200c')
    expect(band.stroke).toBe('#ffdd22')
    // Não desloca o fundo nem consome a área dos produtos.
    expect(JSON.stringify([band, zone]).replace(/,"dirty":true/g, '')).toBe(geometry)
    expect(layoutOfferValidityBanner(objects)).toBe(false)
  })

  it('troca o período entre anos e restaura a fonte quando a data volta a ser curta', () => {
    const { objects, band, date } = fixture()
    band.width = 700
    layoutOfferValidityBanner(objects)
    const initialSize = date.fontSize
    const value = { startDate: '2026-12-30', endDate: '2027-01-02', mode: 'date_range', layout: 'offer-banner' }
    date.text = resolveSplitFooterValidityText(date, objects, value)
    layoutOfferValidityBanner(objects)
    expect(date.text).toBe('30 DE DEZEMBRO DE 2026 A 2 DE JANEIRO DE 2027')
    expectInside(date, band)
    expect(date.fontSize).toBeLessThan(initialSize)
    date.text = '18 DE SETEMBRO'
    layoutOfferValidityBanner(objects)
    expect(date.fontSize).toBeCloseTo(initialSize)
    expect(layoutOfferValidityBanner(objects)).toBe(false)
  })

  it('recolhe o aviso ao desativar estoques e alterna ocultar/mostrar toda a faixa', () => {
    const { objects, band, heading, date, stock } = fixture()
    stock.text = ''
    layoutOfferValidityBanner(objects)
    expect(stock.visible).toBe(false)
    expectInside(date, band)
    date.visible = false
    layoutOfferValidityBanner(objects)
    expect([band, heading, date, stock].every(field => field.visible === false)).toBe(true)
    date.visible = true
    layoutOfferValidityBanner(objects)
    expect(band.visible).toBe(true)
    expect(heading.visible).toBe(true)
    expect(stock.visible).toBe(false)
    expectInside(date, band)
  })

  it('preserva a nova faixa nos reparos de família e não altera outros frames', () => {
    const { objects, band, date, zone } = fixture()
    objects[0].name = 'template-frame-fim-semana-familia-stories'
    objects.push(text({ businessProfileField: 'whatsapp', text: '(64) 99999-9999', left: 600, top: 200, width: 400 }))
    const other = text({ parentFrameId: 'another', name: 'validity-heading', text: 'OUTRA PÁGINA' })
    objects.push(other)
    const beforeOther = JSON.stringify(other), beforeZone = JSON.stringify(zone)
    expect(repairDynamicTextLayoutBounds(objects).unresolved).toEqual([])
    expect(date.quickValidityLayout).toBe('offer-banner')
    expectInside(date, band)
    expect(JSON.stringify(other)).toBe(beforeOther)
    expect(JSON.stringify(zone)).toBe(beforeZone)
    expect(repairDynamicTextLayoutBounds(objects).changed).toBe(false)
  })

  it('mantém cores de caracteres editados durante o ajuste de fonte', () => {
    const { objects, date, band } = fixture()
    date.styles = { 0: { 0: { fill: '#11bbcc', fontWeight: 900 } } }
    date.text = '30 DE DEZEMBRO DE 2026 A 2 DE JANEIRO DE 2027'
    layoutOfferValidityBanner(objects)
    expect(date.styles[0][0]).toEqual({ fill: '#11bbcc', fontWeight: 900 })
    expectInside(date, band)
    expect(layoutOfferValidityBanner(objects)).toBe(false)
  })

  it('usa a chamada correspondente a dia único, intervalo e somente estoques', () => {
    expect(splitFooterValidityText({ startDate: '2026-09-18', layout: 'offer-banner' })).toEqual({
      heading: 'OFERTAS VÁLIDAS NO DIA', period: '18 DE SETEMBRO', stock: 'OU ENQUANTO DURAREM OS ESTOQUES'
    })
    expect(splitFooterValidityText({ startDate: '2026-09-18', endDate: '2026-09-19', layout: 'offer-banner' }).period).toBe('18 A 19 DE SETEMBRO')
    expect(splitFooterValidityText({ mode: 'while_stocks', layout: 'offer-banner' })).toEqual({
      heading: 'OFERTAS VÁLIDAS', period: 'ENQUANTO DURAREM OS ESTOQUES', stock: ''
    })
  })
})
