import { describe, expect, it } from 'vitest'
import {
  createMissingFormatCanvas,
  ensureHeaderValidity,
  refineFooterSpacing,
  hasUsableFrame,
  normalizeTemplateCanvas,
  objectBounds,
  validateTemplateCanvas
} from '../../scripts/standardize-flyer-template-dynamics.mjs'

const page = (format = 'tv', width = 1920, height = 1080) => ({
  id: `page-${format}`,
  name: `Modelo · ${format}`,
  width,
  height,
  templateFormatId: format,
  templateFormatLabel: format,
  templateModelId: 'modelo-1',
  templateModelName: 'Modelo'
})

const frame = (width = 1920, height = 1080) => ({
  type: 'Rect', _customId: 'frame', isFrame: true, originX: 'left', originY: 'top',
  left: 0, top: 0, width, height, scaleX: 1, scaleY: 1, fill: '#0636a7'
})

const zone = (width = 1200, height = 700) => ({
  type: 'Group', _customId: 'zone', isProductZone: true, parentFrameId: 'frame',
  originX: 'left', originY: 'top', left: 620, top: 170, width, height, scaleX: 1, scaleY: 1,
  _zoneWidth: width, _zoneHeight: height, _zoneStateSnapshot: { zone: { geometry: {} } }, objects: []
})

const textbox = (field: string, left: number, top: number, width: number, text: string) => ({
  type: 'Textbox', _customId: field, parentFrameId: 'frame', originX: 'left', originY: 'top',
  left, top, width, height: 30, scaleX: 1, scaleY: 1, text,
  businessProfileField: field, quickFieldEnabled: true
})

describe('standardize flyer template dynamics', () => {
  it('adds a header validity and four footer bindings to a horizontal model without covering the zone', () => {
    const source = { version: '7.1.0', objects: [frame(), zone()] }
    const result = normalizeTemplateCanvas({ canvas: source, page: page('tv') })
    const footer = result.canvas.objects.find((object: any) => object.name === 'footer-premium-background')
    const productZone = result.canvas.objects.find((object: any) => object.isProductZone)
    const validity = result.canvas.objects.find((object: any) => object.quickDataField === 'validity')

    expect(result.changed).toBe(true)
    expect(result.validation).toEqual({ ok: true, errors: [] })
    expect(validity.name).toBe('header-validity')
    expect(validity.text).toBe('DEFINA A DATA')
    expect(validity.quickValidityLayout).toBe('calendar-card')
    expect(objectBounds(productZone).bottom).toBeLessThanOrEqual(objectBounds(footer).top - 1)
    expect(['instagram', 'whatsapp', 'address', 'footerPaymentImages'].every((field) =>
      result.canvas.objects.some((object: any) => object.businessProfileField === field)
    )).toBe(true)
  })

  it('keeps configured dates and places the calendar below the logo with a contact row and payment strip', () => {
    const source = { objects: [frame(1080, 1920), { ...zone(1000, 1200), left: 40, top: 550 },
      { type: 'Rect', businessProfileField: 'logo', quickLogoSlot: true, width: 400, height: 250 },
      { ...textbox('validity', 500, 20, 450, 'old'), quickDataField: 'validity', quickValidityStartDate: '2026-09-13', quickValidityEndDate: '2026-09-14' }] }
    const { canvas } = normalizeTemplateCanvas({ canvas: source, page: page('stories', 1080, 1920), forceFooter: true, forceValidity: true })
    const get = (name: string) => canvas.objects.find((o: any) => o.name === name)
    expect(get('header-validity').text).toBe('13 E 14 DE\nSETEMBRO')
    expect(get('standard-validity-background').fill).toBe('#ffe500')
    const logo = canvas.objects.find((o: any) => o.businessProfileField === 'logo')
    expect(objectBounds(logo).bottom).toBeLessThan(objectBounds(get('standard-validity-background')).top)
    expect(get('footer-contact-instagram').top).toBe(get('footer-contact-whatsapp').top)
    expect(get('footer-contact-address').top).toBe(get('footer-contact-instagram').top)
    expect(get('footer-contact-payments').top).toBeGreaterThan(get('footer-contact-address').top)
  })

  it('does not rewrite a vertical model that already has the standard dynamic fields inside its frame', () => {
    const source = {
      version: '7.1.0',
      objects: [
        frame(1080, 1350),
        { ...zone(1040, 950), left: 20, top: 170 },
        { type: 'Textbox', _customId: 'validity', parentFrameId: 'frame', originX: 'left', originY: 'top', left: 500, top: 40, width: 500, height: 40, scaleX: 1, scaleY: 1, text: 'OFERTA VÁLIDA', quickDataField: 'validity' },
        { type: 'Rect', _customId: 'footer', parentFrameId: 'frame', name: 'footer-premium-background', originX: 'left', originY: 'top', left: 0, top: 1230, width: 1080, height: 120, scaleX: 1, scaleY: 1 },
        textbox('instagram', 18, 1260, 220, '@loja'),
        textbox('whatsapp', 280, 1260, 220, '(64) 99999-9999'),
        textbox('address', 540, 1260, 220, 'Rua Exemplo'),
        { type: 'Rect', _customId: 'payments', parentFrameId: 'frame', businessProfileField: 'footerPaymentImages', originX: 'left', originY: 'top', left: 810, top: 1260, width: 220, height: 60, scaleX: 1, scaleY: 1 }
      ]
    }
    const result = normalizeTemplateCanvas({ canvas: source, page: page('feed', 1080, 1350) })
    expect(result.changed).toBe(false)
    expect(result.validation.ok).toBe(true)
  })

  it('rebuilds a source whose zone already escapes the frame instead of preserving a broken grid', () => {
    const source = {
      version: '7.1.0',
      objects: [
        frame(1080, 1080),
        { ...zone(1055.2, 433.3), left: 555.1, top: 671.4, originX: 'center', originY: 'center' }
      ]
    }
    expect(hasUsableFrame(source, page('square', 1080, 1080))).toBe(false)
  })

  it('builds each missing format with an independent frame, zone, validity, and footer', () => {
    const donor = zone(900, 620)
    const project = { id: 'project', name: 'Ofertas da Semana', canvas_data: [], template_config: { defaultModelId: 'modelo-1', models: [{ id: 'modelo-1', name: 'Modelo' }] } }
    for (const format of [
      ['feed', 'Feed 4:5', 1080, 1350],
      ['square', 'Post 1:1', 1080, 1080],
      ['stories', 'Story 9:16', 1080, 1920],
      ['print', 'A4', 794, 1123],
      ['tv', 'Banner 16:9', 1920, 1080]
    ]) {
      const canvas = createMissingFormatCanvas({ project, sourceCanvas: null, donorZone: donor, format })
      const currentPage = page(String(format[0]), Number(format[2]), Number(format[3]))
      const normalized = normalizeTemplateCanvas({ canvas, page: currentPage, donorZone: donor, forceFooter: true, forceValidity: true })
      expect(validateTemplateCanvas(normalized.canvas, currentPage)).toEqual({ ok: true, errors: [] })
      expect(normalized.canvas.objects.find((object: any) => object.isFrame)?.width).toBe(format[2])
      expect(normalized.canvas.objects.find((object: any) => object.isFrame)?.height).toBe(format[3])
    }
  })
})

it('não força duas linhas quando a oferta vale por um único dia', () => {
  const date = { ...textbox('validity', 500, 30, 400, '14 DE SETEMBRO'), quickDataField: 'validity', quickValidityStartDate: '2026-09-14', quickValidityEndDate: '2026-09-14', quickValidityMode: 'single_day' }
  const canvas = { objects: [frame(1080, 1920), { ...zone(1000, 1200), left: 40, top: 550 }, date] }
  ensureHeaderValidity(canvas, page('stories', 1080, 1920))
  expect(date.text).toBe('14 DE SETEMBRO')
})

it('aproveita o painel dos produtos e melhora o rodapé sem alterar o cabeçalho', () => {
 const seal = { name:'Selo', left:20, top:20, width:400, height:300 }
 const backdrop = { type:'Rect',name:'product-area-background',left:28,top:450,width:1024,height:734,scaleX:1,scaleY:1 }
 const products = { ...zone(972,690),left:54,top:479 }
 const footer = { name:'footer-premium-background',left:0,top:1230,width:1080,height:120 }
 const canvas = {objects:[frame(1080,1350),seal,backdrop,products,footer]}
 const before=JSON.stringify(seal)
 refineFooterSpacing(canvas)
 expect(objectBounds(backdrop).bottom).toBe(1220)
 expect(objectBounds(products).bottom).toBe(1202)
 expect(objectBounds(products).left).toBe(46)
 expect(products._zoneStateSnapshot.zone.geometry).toMatchObject({height:objectBounds(products).height})
 expect(JSON.stringify(seal)).toBe(before)
 const result=JSON.stringify(canvas)
 refineFooterSpacing(canvas)
 expect(JSON.stringify(canvas)).toBe(result)
})
