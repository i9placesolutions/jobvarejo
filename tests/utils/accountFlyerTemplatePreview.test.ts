import { describe, expect, it } from 'vitest'
import {
  bindAccountLogoToFlyerCanvas,
  buildAccountFlyerPreviewCacheKey,
  getAccountFlyerTemplateCanvasData,
  getAccountFlyerTemplateCanvasDataPath,
  getAccountFlyerTemplatePages,
  getAccountFlyerLogoPreference,
  getAccountFlyerLogoSource,
  normalizeAccountFlyerCanvasImageSources,
  runWithAccountFlyerPreviewConcurrency,
  shouldRenderAccountFlyerPreview,
  shouldStartAccountFlyerPreview
} from '~/utils/accountFlyerTemplatePreview'

describe('accountFlyerTemplatePreview', () => {
  it('uses one neutral image in an eager gallery card instead of rendering its canvas', () => {
    expect(shouldStartAccountFlyerPreview({
      profileReady: true,
      hasTemplateId: true,
      isVisible: true,
      rendererInProgress: false,
      hasRenderedPreview: false
    })).toBe(true)
    expect(shouldRenderAccountFlyerPreview({
      hasGalleryPreview: true,
      personalize: false,
      accountHasLogo: true
    })).toBe(false)
  })

  it('keeps the neutral modal image while personalized rendering is already in progress', () => {
    expect(shouldStartAccountFlyerPreview({
      profileReady: true,
      hasTemplateId: true,
      isVisible: true,
      rendererInProgress: true,
      hasRenderedPreview: false
    })).toBe(false)
    expect(shouldRenderAccountFlyerPreview({
      hasGalleryPreview: true,
      personalize: true,
      accountHasLogo: true
    })).toBe(true)
  })

  it('isolates cached previews by account logo and model revision', () => {
    const base = {
      templateId: 'template-1',
      accountId: 'account-1',
      logoSource: 'logo-a.png',
      logoPreference: { outline: true },
      revision: '2026-09-30T10:00:00Z'
    }
    const key = buildAccountFlyerPreviewCacheKey(base)

    expect(buildAccountFlyerPreviewCacheKey({ ...base })).toBe(key)
    expect(buildAccountFlyerPreviewCacheKey({ ...base, accountId: 'account-2' })).not.toBe(key)
    expect(buildAccountFlyerPreviewCacheKey({ ...base, logoSource: 'logo-b.png' })).not.toBe(key)
    expect(buildAccountFlyerPreviewCacheKey({ ...base, revision: '2026-09-30T11:00:00Z' })).not.toBe(key)
  })

  it('reads canvas page metadata from the projects API response shape', () => {
    const project = {
      id: 'template-id',
      template_config: { defaultModelId: 'model-a', defaultFormatId: 'feed' },
      canvas_data: {
        pages: [{ id: 'page-a', canvas_data_path: 'templates/model-a/page-a.json.gz' }]
      }
    }
    const [page] = getAccountFlyerTemplatePages(project)

    expect(page?.id).toBe('page-a')
    expect(getAccountFlyerTemplateCanvasDataPath(page)).toBe('templates/model-a/page-a.json.gz')
    expect(getAccountFlyerTemplateCanvasData({ canvas_data: '{"objects":[]}' })).toEqual({ objects: [] })
  })

  it('normalizes Wasabi image keys on a clone before thumbnail rendering', () => {
    const source = {
      objects: [{
        type: 'image',
        src: 'projects/template-1/pages/page-1/logo.png',
        __originalSrc: 'projects/template-1/pages/page-1/original.png'
      }]
    }
    const normalized = normalizeAccountFlyerCanvasImageSources(source)

    expect(normalized.objects[0].src).toContain('/api/storage/p?key=projects%2Ftemplate-1%2Fpages%2Fpage-1%2Flogo.png')
    expect(normalized.objects[0].__originalSrc).toBe(source.objects[0]!.__originalSrc)
    expect(source.objects[0]!.src).toBe('projects/template-1/pages/page-1/logo.png')
  })

  it('binds only dynamic logo slots to the selected account and preserves the slot bounds', () => {
    const source = {
      objects: [
        {
          type: 'image',
          src: 'https://assets.test/owner-logo.png',
          businessProfileField: 'logo',
          _customId: 'dynamic-logo',
          left: 30,
          top: 50,
          width: 200,
          height: 60,
          scaleX: 0.5,
          scaleY: 0.5,
          originX: 'left',
          originY: 'top',
          quickLogoMaxWidth: 120,
          quickLogoMaxHeight: 80,
          quickLogoBackdropId: 'logo-backdrop'
        },
        { type: 'image', src: 'https://assets.test/static-brand.png', left: 8, top: 9, width: 20, height: 10 }
      ]
    }

    const result = bindAccountLogoToFlyerCanvas(source, {
      logoSrc: 'https://assets.test/customer-logo.png',
      logoSize: { width: 400, height: 100, cropX: 12, cropY: 8 }
    })

    expect(result.objects).toHaveLength(2)
    expect(result.objects[0]).toMatchObject({
      type: 'Image',
      src: 'https://assets.test/customer-logo.png',
      quickLogoSource: 'https://assets.test/customer-logo.png',
      left: 80,
      top: 65,
      width: 400,
      height: 100,
      scaleX: 0.3,
      scaleY: 0.3,
      cropX: 12,
      cropY: 8
    })
    expect(result.objects[1].src).toBe('https://assets.test/static-brand.png')
    expect(source.objects[0]!.src).toBe('https://assets.test/owner-logo.png')
  })

  it('removes dynamic logo and its backdrop if the account has no logo or the field is disabled', () => {
    const source = {
      objects: [
        { type: 'image', businessProfileField: 'logo', _customId: 'missing-logo', quickLogoBackdropId: 'missing-backdrop' },
        { type: 'rect', quickLogoBackdrop: true, _customId: 'missing-backdrop', quickLogoBackdropOwnerId: 'missing-logo' },
        { type: 'rect', quickLogoSlot: true, quickFieldEnabled: false, _customId: 'disabled-logo' },
        { type: 'image', src: 'static.png' }
      ]
    }

    const result = bindAccountLogoToFlyerCanvas(source, { logoSrc: '', logoSize: null })
    expect(result.objects).toEqual([{ type: 'image', src: 'static.png' }])
  })

  it('applies explicit account logo preferences, including disabled borders', () => {
    const source = { objects: [{ type: 'rect', quickLogoSlot: true, width: 100, height: 100 }] }
    const result = bindAccountLogoToFlyerCanvas(source, {
      logoSrc: 'logo.png',
      logoSize: { width: 10, height: 10 },
      logoPreference: { border: false, outline: false, backdrop: 'none' }
    })
    expect(result.objects[0]).toMatchObject({
      __strokeEnabled: false,
      stroke: null,
      strokeWidth: 0,
      __stickerOutlineEnabled: false,
      quickLogoBackdropMode: 'none'
    })
  })

  it('removes generated white plates without touching custom 3D artwork or products', () => {
    const source = { objects: [
      { type: 'image', businessProfileField: 'logo', _customId: 'logo', quickLogoBackdropId: 'plate', width: 100, height: 60, quickLogoBackdropMode: 'square', __stickerOutlineEnabled: true },
      { type: 'Rect', quickLogoBackdrop: true, quickLogoBackdropOwnerId: 'logo', _customId: 'plate', fill: '#fff' },
      { type: 'image', src: 'custom-3d-base.png', _customId: 'decoration' },
      { type: 'rect', isProductZone: true, width: 700, height: 900 }
    ] }
    const options = { logoSrc: 'brand.png', logoSize: { width: 200, height: 100 } }
    const result = bindAccountLogoToFlyerCanvas(source, options)
    expect(result.objects).toHaveLength(3)
    expect(result.objects[0]).toMatchObject({ quickLogoBackdropMode: 'none', __stickerOutlineEnabled: false })
    expect(result.objects[0].quickLogoBackdropId).toBeUndefined()
    expect(result.objects.slice(1)).toEqual(source.objects.slice(2))
    expect(source.objects).toHaveLength(4)
    const optedIn = bindAccountLogoToFlyerCanvas(source, { ...options, logoPreference: { backdrop: 'square', outline: true } })
    expect(optedIn.objects).toHaveLength(4)
    expect(optedIn.objects[0].__stickerOutlineEnabled).toBe(true)
  })

  it('reads the selected account logo and preference from the profile payload', () => {
    const profile = { id: 'account-2', business_profile: { logo: 'logo/account-2.png', logoPreference: { outline: true } } }
    expect(getAccountFlyerLogoSource(profile)).toBe('logo/account-2.png')
    expect(getAccountFlyerLogoPreference(profile)).toEqual({ outline: true })
  })

  it('limits preview jobs to two concurrent tasks', async () => {
    let active = 0
    let peak = 0
    const tasks = Array.from({ length: 6 }, (_, index) => runWithAccountFlyerPreviewConcurrency(async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 5))
      active -= 1
      return index
    }))
    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3, 4, 5])
    expect(peak).toBe(2)
  })
})
