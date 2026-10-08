import { describe, expect, it } from 'vitest'
import { getFlyerGalleryPreviewKey } from '../../server/utils/flyer-gallery-previews'

const hash = 'a'.repeat(64)
const revision = '2026-09-30T01:26:59.889Z'
const asset = { revision, key: `imagens/catalogo-encartes/${hash}.webp`, sha256: hash, bytes: 19000, sourcePolicyVersion: 2 }
const catalog = { version: 1, assets: { model: asset } }
describe('pre-rendered neutral library thumbnails', () => {
  it('returns only a ready thumbnail of the exact saved revision', () => {
    expect(getFlyerGalleryPreviewKey('model', revision, catalog)).toBe(asset.key)
    expect(getFlyerGalleryPreviewKey('model', new Date(revision), catalog)).toBe(asset.key)
    expect(getFlyerGalleryPreviewKey('model', '2026-09-30T01:26:59.889+00:00', catalog)).toBe(asset.key)
    expect(getFlyerGalleryPreviewKey('model', '2026-09-30T02:26:59.889Z', catalog)).toBeNull()
    expect(getFlyerGalleryPreviewKey('missing', revision, catalog)).toBeNull()
    expect(getFlyerGalleryPreviewKey('model', 'invalid', catalog)).toBeNull()
  })
  it('rejects arbitrary paths, corrupted metadata and unsupported versions', () => {
    for (const invalid of [{ key: 'projects/other/thumbnail.png' }, { sha256: '../secret' }, { bytes: 0 }, { sourcePolicyVersion: 0 }, { sourcePolicyVersion: 1 }]) {
      expect(getFlyerGalleryPreviewKey('model', revision, {version:1,assets:{model:{...asset,...invalid}}})).toBeNull()
    }
    expect(getFlyerGalleryPreviewKey('model', revision, {...catalog,version:2})).toBeNull()
  })
})
