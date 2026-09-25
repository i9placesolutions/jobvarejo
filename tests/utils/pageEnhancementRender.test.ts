import { afterEach, describe, expect, it, vi } from 'vitest'
import { Group, Rect } from 'fabric'
import { classifyEnhancementProtection as classify, clipEnhancementBounds as clip, collectEnhancementProtection as collect, enhancementProtectedArea as area, prepareEnhancedPageInput as prepare } from '../../utils/pageEnhancementRender'

const crop = { left: 100, top: 200, width: 200, height: 100 }
afterEach(() => vi.unstubAllGlobals())

describe('classification', () => {
  it.each(['Text', 'IText', 'i-text', 'Textbox'])('protects %s', type => expect(classify({ type })).toBe('text'))
  it.each(['background', 'background-image', 'theme-background', 'product-area-background'])('allows only unbound %s images', name => {
    expect(classify({ type: 'image', name })).toBeNull()
    expect(classify({ type: 'image', name, binding: {} })).toBe('image')
    expect(classify({ type: 'image', name, quickDataField: 'logo' })).toBe('image')
    expect(classify({ type: 'image', name, data: { field: 'title' } })).toBe('image')
    expect(classify({ type: 'image', name, businessProfileField: 'logo' })).toBe('identity')
  })
  it.each(['header', 'header-background', 'my-background', 'Background', '', 'product'])('protects %s image', name => expect(classify({ type: 'Image', name })).toBe('image'))
  it('protects cards and identity, including vectors', () => {
    expect(classify({ isProductCard: true })).toBe('card')
    expect(classify({ _productData: {} })).toBe('card')
    expect(classify({ getObjects: () => [{ name: 'smart_title' }] })).toBe('card')
    expect(classify({ type: 'path', name: 'business-logo' })).toBe('identity')
    expect(classify({ type: 'rect', isLogo: true })).toBe('identity')
    expect(classify({ type: 'rect', businessProfileField: 'address' })).toBe('identity')
    expect(classify({ type: 'rect' })).toBeNull()
  })
})

describe('absolute bounds and coverage', () => {
  it('pads text, clips and rounds outward in output pixels', () => {
    expect(clip({ left: 98, top: 202, width: 14, height: 10 }, crop, 0.5, 4))
      .toEqual({ left: 0, top: 0, width: 8, height: 8 })
    expect(clip({ left: 400, top: 200, width: 10, height: 10 }, crop)).toBeNull()
    expect(() => clip({ left: NaN, top: 0, width: 1, height: 1 }, crop)).toThrow()
  })
  it('uses real Fabric bounds through nested rotated, scaled and flipped groups', () => {
    const child = new Rect({ width: 40, height: 20, left: 10, top: 20 })
    Object.assign(child, { businessProfileField: 'logo' })
    const inner = new Group([child], { angle: 30, scaleX: 2, flipX: true })
    const outer = new Group([inner], { left: 140, top: 230, angle: -15, scaleY: 1.5 })
    const bounds = child.getBoundingRect()
    const before = outer.toObject()
    expect(collect([outer as any], crop)).toEqual([clip(bounds, crop)])
    expect(outer.toObject()).toEqual(before)
  })
  it('protects whole cards plus overflowing nested text and clips outside objects', () => {
    const text = { type: 'textbox', getBoundingRect: () => ({ left: 110, top: 210, width: 10, height: 10 }) }
    const card = { isProductCard: true, getBoundingRect: () => crop, getObjects: () => [text] }
    expect(collect([card], crop)).toEqual([
      { left: 0, top: 0, width: 200, height: 100 }, { left: 6, top: 6, width: 18, height: 18 }
    ])
    expect(area(collect([card], crop))).toBe(20000)
    expect(() => collect([{ type: 'text' }], crop)).toThrow()
  })
  it('counts overlapping and disjoint rectangles only once', () => {
    expect(area([{ left: 0, top: 0, width: 10, height: 10 }, { left: 5, top: 5, width: 10, height: 10 }])).toBe(175)
    expect(area([])).toBe(0)
  })
})

function setup(bounds = { left: 110, top: 210, width: 20, height: 20 }) {
  vi.stubGlobal('document', {})
  const context = { fillStyle: '', fillRect: vi.fn() }
  const mask = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn(() => 'data:image/png;base64,mask') }
  const canvas = {
    width: 1000, height: 1000, viewportTransform: [1, 0, 0, 1, 0, 0], enableRetinaScaling: true,
    skipControlsDrawing: false, vptCoords: {},
    getObjects: () => [{ type: 'image', getBoundingRect: () => bounds }],
    toDataURL: vi.fn(() => 'data:image/png;base64,original')
  }
  const options = { canvas: canvas as any, fabric: { util: { createCanvasElement: () => mask as any } }, width: 1000, height: 1000, crop }
  return { options, canvas, mask, context }
}

it('exports PNG without retina scaling or controls and preserves state', async () => {
  const { options, canvas, context } = setup()
  const state = { ...canvas }
  const result = await prepare(options)
  expect(result).toMatchObject({ width: 200, height: 100, protectedCount: 1, protectedFraction: 0.02, nearlyAllProtected: false })
  expect(canvas.toDataURL).toHaveBeenCalledWith({ ...crop, multiplier: 1, format: 'png', enableRetinaScaling: false })
  expect(context.fillRect.mock.calls).toEqual([[0, 0, 200, 100], [10, 10, 20, 20]])
  expect(canvas).toEqual(state)
})
it('caps at 2048 without upscaling and supports negative crop origins', async () => {
  const { options } = setup({ left: 0, top: 0, width: 100, height: 100 })
  options.crop = { left: -100, top: -100, width: 4096, height: 2048 }
  expect(await prepare(options)).toMatchObject({ width: 2048, height: 1024 })
})
it('restores Fabric temporary state even on export failure', async () => {
  const { canvas, options } = setup()
  const state = { ...canvas }
  canvas.toDataURL.mockImplementation(() => {
    Object.assign(canvas, { width: 12, height: 23, viewportTransform: [2, 0, 0, 2, 1, 1], enableRetinaScaling: false, skipControlsDrawing: true, vptCoords: null })
    throw new Error('CORS')
  })
  await expect(prepare(options)).rejects.toThrow('CORS')
  expect(canvas).toEqual(state)
})
it('rejects empty/full masks, invalid dimensions, SSR and nonidentity viewport', async () => {
  const { options, canvas } = setup({ left: 500, top: 500, width: 10, height: 10 })
  await expect(prepare(options)).rejects.toThrow('não contém proteção')
  canvas.getObjects = () => [{ type: 'image', getBoundingRect: () => crop }]
  await expect(prepare(options)).rejects.toThrow('toda a página')
  await expect(prepare({ ...options, width: 0 })).rejects.toThrow('Dimensões')
  canvas.viewportTransform[4] = 10
  await expect(prepare(options)).rejects.toThrow('viewport identidade')
  vi.stubGlobal('document', undefined)
  await expect(prepare(options)).rejects.toThrow('navegador')
})
it('reports nearly all protection and includes canvas background images', async () => {
  const { options, canvas } = setup({ left: 100, top: 200, width: 192, height: 100 })
  expect(await prepare(options)).toMatchObject({ protectedFraction: 0.96, nearlyAllProtected: true })
  Object.assign(canvas, { backgroundImage: { type: 'image', getBoundingRect: () => crop } })
  await expect(prepare(options)).rejects.toThrow('toda a página')
})

// Metadados relevantes do output/limits-contrast/e602f647d066.json.
// Fixture inline mantém a regressão independente dos arquivos locais de output.
const torraBackground = {
  type: 'Image', name: 'Fundo Operação Torra Tudo — Preços Imperdíveis',
  visible: true, excludeFromExport: false,
  __originalSrc: '/api/storage/p?key=projects%2Feb847e8e-7c19-4bee-8042-376528ce6192%2Fe69be142-fce7-4c83-8775-66e03030c071%2Fassets%2Fbackground.png'
}
const torraSeal = { type: 'Image', name: 'Selo 3D Operação Torra Tudo — Preços Imperdíveis' }
const torraLogo = { type: 'Image', name: 'header-logo-slot', layerName: 'Logo da loja', businessProfileField: 'logo', __stickerOutlineEnabled: true, __stickerOutlineWidth: 4 }

it('recognizes the actual Torra background by name AND explicit asset metadata', () => {
  expect(classify(torraBackground)).toBeNull()
  expect(classify({ ...torraBackground, __originalSrc: undefined })).toBe('image')
  expect(classify({ ...torraBackground, __originalSrc: '/unknown/background.png' })).toBe('image')
  expect(classify({ ...torraBackground, binding: 'title' })).toBe('image')
  expect(classify({ type: 'Image', name: 'Fundo Teste', isBackground: true })).toBeNull()
  expect(classify({ type: 'Image', name: 'Fundo Teste', layerName: 'theme-background' })).toBeNull()
  expect(classify({ type: 'Image', name: 'Fundo Teste', layerName: 'header' })).toBe('image')
  expect(classify({ ...torraBackground, businessProfileField: 'logo' })).toBe('identity')
})
it('keeps all Selo 3D sprites and header logos protected regardless of background metadata', () => {
  expect(classify({ ...torraBackground, ...torraSeal, isBackground: true, layerName: 'background' })).toBe('image')
  expect(classify(torraLogo)).toBe('identity')
})
it.each([{ visible: false }, { excludeFromExport: true }])('skips hidden/excluded objects and their entire subtrees: %o', flag => {
  const child = { type: 'image', getBoundingRect: () => crop }
  const getObjects = vi.fn(() => [child])
  expect(collect([{ ...flag, name: 'hiddenzone', isProductCard: true, getBoundingRect: () => crop, getObjects }], crop)).toEqual([])
  expect(getObjects).not.toHaveBeenCalled()
  expect(classify({ ...torraLogo, ...flag })).toBeNull()
  expect(collect([{ getObjects: () => [{ ...child, ...flag }] }], crop)).toEqual([])
})
it('pads only identity images by 4px, preserving the entire sprite rectangle', () => {
  const getBoundingRect = () => ({ left: 110, top: 210, width: 20, height: 20 })
  expect(collect([{ ...torraLogo, getBoundingRect }, { ...torraSeal, getBoundingRect }], crop)).toEqual([
    { left: 6, top: 6, width: 28, height: 28 }, { left: 10, top: 10, width: 20, height: 20 }
  ])
  expect(collect([{ ...torraLogo, getBoundingRect }], crop, 0.5)).toEqual([{ left: 3, top: 3, width: 14, height: 14 }])
})
it('exports Torra without a full-page mask and returns the untouched full-color original export', async () => {
  const { canvas, options } = setup()
  const objects = [
    { ...torraBackground, getBoundingRect: () => crop },
    { ...torraSeal, getBoundingRect: () => ({ left: 110, top: 210, width: 30, height: 30 }) },
    { ...torraLogo, getBoundingRect: () => ({ left: 200, top: 210, width: 20, height: 20 }) },
    { type: 'group', name: 'hiddenzone', visible: false, getObjects: () => [{ type: 'text', getBoundingRect: () => crop }] }
  ]
  options.canvas.getObjects = () => objects as any
  const before = objects.map(object => ({ ...object }))
  canvas.toDataURL.mockReturnValue('data:image/png;base64,full-color-sprites')
  const result = await prepare(options)
  expect(result.original).toBe('data:image/png;base64,full-color-sprites')
  expect(result.protectedCount).toBe(2)
  expect(result.nearlyAllProtected).toBe(false)
  expect(objects).toEqual(before)
})

it.each(['isProductZone', 'isGridZone'])('traverses excluded legacy %s children without protecting the guide box', flag => {
  const child = { isProductCard: true, getBoundingRect: () => ({ left: 110, top: 210, width: 20, height: 20 }) }
  const hiddenImage = { type: 'image', visible: false, getBoundingRect: () => crop }
  const excludedImage = { type: 'image', excludeFromExport: true, getBoundingRect: () => crop }
  const zone = { type: 'group', [flag]: true, excludeFromExport: true, getBoundingRect: () => crop, getObjects: () => [child, hiddenImage, excludedImage] }
  expect(collect([zone], crop)).toEqual([{ left: 10, top: 10, width: 20, height: 20 }])
  expect(collect([{ ...zone, visible: false }], crop)).toEqual([])
})

it('does not infer a full-page card from an invisible smart_title', () => {
  expect(classify({ getObjects: () => [{ name: 'smart_title', type: 'textbox', visible: false }] })).toBeNull()
  expect(classify({ getObjects: () => [{ name: 'smart_title', type: 'textbox', excludeFromExport: true }] })).toBeNull()
})

it('rejects flattened pages before requesting a paid redesign', async () => {
  const { prepareRedesignPageInput } = await import('../../utils/pageEnhancementRender')
  const { options } = setup()
  await expect(prepareRedesignPageInput(options)).rejects.toThrow('produtos editáveis')
})
