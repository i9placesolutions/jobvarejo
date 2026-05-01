import { describe, it, expect } from 'vitest'
import {
  templateSnapshotHasAtacStructure,
  shouldForceCanonicalAtacForTemplateJson,
  shouldUseAtacVariantSnapshotsForTemplate
} from '~/utils/templateSnapshotHelpers'

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
