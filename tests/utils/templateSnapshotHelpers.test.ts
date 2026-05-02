import { describe, it, expect } from 'vitest'
import {
  templateSnapshotHasAtacStructure,
  shouldForceCanonicalAtacForTemplateJson,
  shouldUseAtacVariantSnapshotsForTemplate,
  shouldPreserveManualTemplateVisual,
  restoreMissingManualTemplateFlags,
  pickRenderableTemplateGroupJson
} from '~/utils/templateSnapshotHelpers'

describe('pickRenderableTemplateGroupJson', () => {
  const isRenderable = (g: any) => !!g && Array.isArray(g.objects) && g.objects.length > 0
  const noVariants = () => false
  const useVariants = () => true

  it('null tpl: null', () => {
    expect(pickRenderableTemplateGroupJson(null, undefined, isRenderable, noVariants)).toBe(null)
  })

  it('sem variants + base renderavel: retorna base', () => {
    const tpl = { group: { objects: [{ type: 'rect' }] } }
    expect(pickRenderableTemplateGroupJson(tpl, undefined, isRenderable, noVariants)).toBe(tpl.group)
  })

  it('sem variants + base vazio + variant normal renderavel: retorna variant', () => {
    const variant = { objects: [{ type: 'rect' }] }
    const tpl = { group: { objects: [], __atacVariantGroups: { normal: variant } } }
    expect(pickRenderableTemplateGroupJson(tpl, undefined, isRenderable, noVariants)).toBe(variant)
  })

  it('com variants + preferredKey: retorna variant especifica', () => {
    const variant = { objects: [{ type: 'rect' }] }
    const tpl = { group: { objects: [], __atacVariantGroups: { tiny: variant } } }
    expect(pickRenderableTemplateGroupJson(tpl, 'tiny', isRenderable, useVariants)).toBe(variant)
  })

  it('com variants + preferredKey vazio: cai para base', () => {
    const tpl = { group: { objects: [{ type: 'rect' }] } }
    expect(pickRenderableTemplateGroupJson(tpl, 'tiny', isRenderable, useVariants)).toBe(tpl.group)
  })

  it('todos vazios: null', () => {
    const tpl = { group: { objects: [] } }
    expect(pickRenderableTemplateGroupJson(tpl, undefined, isRenderable, noVariants)).toBe(null)
  })

  it('recovery: usa variant disponivel quando base e' + ' preferred vazios', () => {
    const variant = { objects: [{ type: 'rect' }] }
    const tpl = { group: { objects: [], __atacVariantGroups: { large: variant } } }
    expect(pickRenderableTemplateGroupJson(tpl, undefined, isRenderable, useVariants)).toBe(variant)
  })

  it('aceita "objects array vazio MAS isRenderable=true" como renderavel', () => {
    const customRenderable = (_g: any) => true
    const tpl = { group: { objects: [] } }
    expect(pickRenderableTemplateGroupJson(tpl, undefined, customRenderable, noVariants)).toBe(tpl.group)
  })
})

describe('restoreMissingManualTemplateFlags', () => {
  const alwaysPreserve = () => true
  const neverPreserve = () => false

  it('null/non-group: false', () => {
    expect(restoreMissingManualTemplateFlags(null, alwaysPreserve)).toBe(false)
    expect(restoreMissingManualTemplateFlags({}, alwaysPreserve)).toBe(false)
  })

  it('shouldPreserve=false: false (skip)', () => {
    const pg: any = { getObjects: () => [] }
    expect(restoreMissingManualTemplateFlags(pg, neverPreserve)).toBe(false)
  })

  it('seta __preserveManualLayout/__isCustomTemplate quando ausentes', () => {
    const pg: any = { getObjects: () => [], width: 200, height: 100, scaleX: 1, scaleY: 1 }
    const result = restoreMissingManualTemplateFlags(pg, alwaysPreserve)
    expect(result).toBe(true)
    expect(pg.__preserveManualLayout).toBe(true)
    expect(pg.__isCustomTemplate).toBe(true)
  })

  it('preserva flags ja definidas como true', () => {
    const pg: any = {
      getObjects: () => [],
      width: 200,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      __preserveManualLayout: true,
      __isCustomTemplate: true,
      __manualTemplateBaseW: 200,
      __manualTemplateBaseH: 100
    }
    const result = restoreMissingManualTemplateFlags(pg, alwaysPreserve)
    expect(result).toBe(false) // nada para mudar
  })

  it('grava __manualTemplateBaseW/H usando width/height raw', () => {
    const pg: any = {
      getObjects: () => [],
      width: 250,
      height: 80,
      scaleX: 1,
      scaleY: 1
    }
    restoreMissingManualTemplateFlags(pg, alwaysPreserve)
    expect(pg.__manualTemplateBaseW).toBe(250)
    expect(pg.__manualTemplateBaseH).toBe(80)
  })

  it('fallback: width=0, usa scaledWidth/scaleX', () => {
    const pg: any = {
      getObjects: () => [],
      width: 0,
      height: 0,
      scaleX: 2,
      scaleY: 2,
      getScaledWidth: () => 400,
      getScaledHeight: () => 200
    }
    restoreMissingManualTemplateFlags(pg, alwaysPreserve)
    expect(pg.__manualTemplateBaseW).toBe(200) // 400/2
    expect(pg.__manualTemplateBaseH).toBe(100) // 200/2
  })

  it('preserva BaseW/H quando ja existem (mesmo tendo width raw)', () => {
    const pg: any = {
      getObjects: () => [],
      width: 999,
      height: 999,
      scaleX: 1,
      scaleY: 1,
      __manualTemplateBaseW: 200,
      __manualTemplateBaseH: 100
    }
    restoreMissingManualTemplateFlags(pg, alwaysPreserve)
    expect(pg.__manualTemplateBaseW).toBe(200)
    expect(pg.__manualTemplateBaseH).toBe(100)
  })
})

describe('shouldPreserveManualTemplateVisual', () => {
  const noRedBurst = () => false
  const makeGroup = (children: any[], extra: any = {}) => ({
    type: 'group',
    getObjects: () => children,
    ...extra
  })

  it('null/non-group: false', () => {
    expect(shouldPreserveManualTemplateVisual(null, noRedBurst)).toBe(false)
    expect(shouldPreserveManualTemplateVisual({}, noRedBurst)).toBe(false)
  })

  it('__preserveManualLayout=true: true imediato', () => {
    const g = makeGroup([], { __preserveManualLayout: true })
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })

  it('__isCustomTemplate=true: true imediato', () => {
    const g = makeGroup([], { __isCustomTemplate: true })
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })

  it('__forceAtacarejoCanonical=true: false (forca atac)', () => {
    const g = makeGroup([{ name: 'price_header_bg' }], { __forceAtacarejoCanonical: true })
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(false)
  })

  it('isRedBurstCheck=true: true (manual)', () => {
    const g = makeGroup([])
    expect(shouldPreserveManualTemplateVisual(g, () => true)).toBe(true)
  })

  it('children vazios: false', () => {
    expect(shouldPreserveManualTemplateVisual(makeGroup([]), noRedBurst)).toBe(false)
  })

  it('atac_retail_bg presente: false (atac default)', () => {
    const g = makeGroup([{ name: 'atac_retail_bg' }])
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(false)
  })

  it('price_header_bg presente: true (custom header)', () => {
    const g = makeGroup([{ name: 'price_header_bg' }])
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })

  it('price_header_text presente: true', () => {
    const g = makeGroup([{ name: 'price_header_text' }])
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })

  it('crianca com __originalLeft finito: true', () => {
    const g = makeGroup([{ name: 'priceInteger', __originalLeft: 10 }])
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })

  it('crianca com __originalFontSize: true', () => {
    const g = makeGroup([{ __originalFontSize: 32 }])
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })

  it('children sem flags + sem header + sem metrics: false', () => {
    const g = makeGroup([{ name: 'priceInteger' }])
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(false)
  })

  it('atac_retail_bg + __preserveManualLayout=true: __preserve vence (true)', () => {
    const g = makeGroup([{ name: 'atac_retail_bg' }], { __preserveManualLayout: true })
    expect(shouldPreserveManualTemplateVisual(g, noRedBurst)).toBe(true)
  })
})

describe('templateSnapshotHasAtacStructure', () => {
  it('null/non-object → false', () => {
    expect(templateSnapshotHasAtacStructure(null)).toBe(false)
    expect(templateSnapshotHasAtacStructure(undefined)).toBe(false)
    expect(templateSnapshotHasAtacStructure('snapshot' as any)).toBe(false)
  })

  it('snapshot raiz com name=atac_retail_bg → true', () => {
    expect(templateSnapshotHasAtacStructure({ name: 'atac_retail_bg' })).toBe(true)
  })

  it('snapshot sem atac_retail_bg em qualquer nivel → false', () => {
    expect(templateSnapshotHasAtacStructure({ name: 'priceGroup' })).toBe(false)
    expect(templateSnapshotHasAtacStructure({
      objects: [{ name: 'price_integer' }, { name: 'price_decimal' }]
    })).toBe(false)
  })

  it('encontra atac_retail_bg em children JSON (objects)', () => {
    expect(templateSnapshotHasAtacStructure({
      objects: [
        { name: 'priceGroup' },
        { name: 'atac_retail_bg' }
      ]
    })).toBe(true)
  })

  it('encontra atac_retail_bg em children Fabric (_objects)', () => {
    expect(templateSnapshotHasAtacStructure({
      _objects: [{ name: 'atac_retail_bg' }]
    })).toBe(true)
  })

  it('encontra atac_retail_bg via getObjects()', () => {
    expect(templateSnapshotHasAtacStructure({
      getObjects: () => [{ name: 'atac_retail_bg' }]
    })).toBe(true)
  })

  it('desce em multiplos niveis', () => {
    const snapshot = {
      objects: [
        {
          name: 'group1',
          objects: [
            {
              name: 'group2',
              objects: [{ name: 'atac_retail_bg' }]
            }
          ]
        }
      ]
    }
    expect(templateSnapshotHasAtacStructure(snapshot)).toBe(true)
  })

  it('mistura JSON + Fabric children num mesmo nivel', () => {
    expect(templateSnapshotHasAtacStructure({
      objects: [{ name: 'foo' }],
      _objects: [{ name: 'atac_retail_bg' }]
    })).toBe(true)
  })

  it('children invalidos (null/string) ignorados', () => {
    expect(templateSnapshotHasAtacStructure({
      objects: [null, 'string', undefined, { name: 'atac_retail_bg' }]
    })).toBe(true)
  })

  it('iterativo — niveis profundos nao causam stack overflow', () => {
    let deepest: any = { name: 'atac_retail_bg' }
    for (let i = 0; i < 1000; i += 1) {
      deepest = { name: `level-${i}`, objects: [deepest] }
    }
    expect(templateSnapshotHasAtacStructure({ objects: [deepest] })).toBe(true)
  })
})

describe('shouldForceCanonicalAtacForTemplateJson', () => {
  it('snapshot com __forceAtacarejoCanonical=true → true', () => {
    expect(shouldForceCanonicalAtacForTemplateJson({
      __forceAtacarejoCanonical: true
    })).toBe(true)
  })

  it('snapshot com __forceAtacarejoCanonical=false → false', () => {
    expect(shouldForceCanonicalAtacForTemplateJson({
      __forceAtacarejoCanonical: false
    })).toBe(false)
  })

  it('flag ausente → false', () => {
    expect(shouldForceCanonicalAtacForTemplateJson({})).toBe(false)
    expect(shouldForceCanonicalAtacForTemplateJson({ name: 'atac_retail_bg' })).toBe(false)
  })

  it('null/undefined/non-object → false', () => {
    expect(shouldForceCanonicalAtacForTemplateJson(null)).toBe(false)
    expect(shouldForceCanonicalAtacForTemplateJson(undefined)).toBe(false)
    expect(shouldForceCanonicalAtacForTemplateJson('foo' as any)).toBe(false)
  })

  it('flag truthy nao boolean (1, "true") → false (apenas === true)', () => {
    expect(shouldForceCanonicalAtacForTemplateJson({
      __forceAtacarejoCanonical: 1
    })).toBe(false)
    expect(shouldForceCanonicalAtacForTemplateJson({
      __forceAtacarejoCanonical: 'true'
    })).toBe(false)
  })
})

describe('shouldUseAtacVariantSnapshotsForTemplate', () => {
  it('sempre retorna false (decisao fixa)', () => {
    expect(shouldUseAtacVariantSnapshotsForTemplate({})).toBe(false)
    expect(shouldUseAtacVariantSnapshotsForTemplate(null)).toBe(false)
    expect(shouldUseAtacVariantSnapshotsForTemplate({
      name: 'atac_retail_bg', __forceAtacarejoCanonical: true
    })).toBe(false)
  })
})
