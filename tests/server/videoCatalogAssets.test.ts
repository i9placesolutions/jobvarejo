import { describe, expect, it } from 'vitest'
import {
  matchesVideoCatalogEtag,
  normalizeVideoCatalogPath,
  parseVideoCatalogRange,
  shouldHonorVideoCatalogRange,
  resolveVideoCatalogAsset,
  videoCatalogEtag,
  type VideoCatalogManifest
} from '../../server/utils/video-studio/catalog-assets'

const sha256 = 'a'.repeat(64)
const path = 'audio/impact.mp3'
const manifest: VideoCatalogManifest = {
  version: 1,
  assets: {
    [path]: {
      key: `video-studio/catalog/${sha256}/${path}`,
      sha256,
      bytes: 100,
      contentType: 'audio/mpeg'
    }
  }
}

describe('Video Studio catalog assets', () => {
  it('allows only normalized audio/template paths present in the manifest', () => {
    expect(normalizeVideoCatalogPath(path)).toBe(path)
    expect(resolveVideoCatalogAsset(manifest, path)).toEqual(manifest.assets[path])
    expect(resolveVideoCatalogAsset(manifest, 'audio/not-listed.mp3')).toBeNull()
    expect(normalizeVideoCatalogPath('../audio/impact.mp3')).toBeNull()
    expect(normalizeVideoCatalogPath('audio/%2e%2e/private.mp3')).toBeNull()
    expect(normalizeVideoCatalogPath('projects/user/file')).toBeNull()
  })

  it('uses the full object when If-Range refers to another version', () => {
    const etag = videoCatalogEtag(sha256)
    expect(shouldHonorVideoCatalogRange(undefined, etag)).toBe(true)
    expect(shouldHonorVideoCatalogRange(etag, etag)).toBe(true)
    expect(shouldHonorVideoCatalogRange('"old-version"', etag)).toBe(false)
    expect(shouldHonorVideoCatalogRange(`W/${etag}`, etag)).toBe(false)
  })

  it('rejects manifest entries that point outside the content-addressed catalog key', () => {
    const tampered = structuredClone(manifest)
    tampered.assets[path]!.key = 'projects/private/file'
    expect(resolveVideoCatalogAsset(tampered, path)).toBeNull()
  })

  it('parses only valid single byte ranges, including suffix ranges', () => {
    expect(parseVideoCatalogRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 })
    expect(parseVideoCatalogRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 })
    expect(parseVideoCatalogRange('bytes=-5', 100)).toEqual({ start: 95, end: 99 })
    expect(parseVideoCatalogRange('bytes=0-500', 100)).toEqual({ start: 0, end: 99 })
    expect(parseVideoCatalogRange('bytes=100-', 100)).toBe('invalid')
    expect(parseVideoCatalogRange('bytes=1-2,5-6', 100)).toBe('invalid')
    expect(parseVideoCatalogRange('items=1-2', 100)).toBe('invalid')
  })

  it('uses the manifest SHA-256 as a stable ETag and recognizes conditional matches', () => {
    const etag = videoCatalogEtag(sha256)
    expect(etag).toBe(`"${sha256}"`)
    expect(matchesVideoCatalogEtag(etag, etag)).toBe(true)
    expect(matchesVideoCatalogEtag(`W/${etag}`, etag)).toBe(true)
    expect(matchesVideoCatalogEtag('"other", *', etag)).toBe(true)
    expect(matchesVideoCatalogEtag('"other"', etag)).toBe(false)
  })
})
