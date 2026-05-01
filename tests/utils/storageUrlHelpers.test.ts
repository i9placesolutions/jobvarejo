import { describe, it, expect } from 'vitest'
import {
  extractWasabiBucketAndKey,
  extractWasabiKey
} from '~/utils/storageUrlHelpers'

describe('extractWasabiBucketAndKey', () => {
  it('URL path-style classica', () => {
    expect(extractWasabiBucketAndKey('https://s3.wasabisys.com/jobvarejo/projects/u1/p1/page.json'))
      .toEqual({ bucket: 'jobvarejo', key: 'projects/u1/p1/page.json' })
  })

  it('key com varios segmentos', () => {
    expect(extractWasabiBucketAndKey('https://s3.wasabisys.com/jobvarejo/a/b/c/d/file.png'))
      .toEqual({ bucket: 'jobvarejo', key: 'a/b/c/d/file.png' })
  })

  it('URL apenas com bucket (sem key) retorna null', () => {
    expect(extractWasabiBucketAndKey('https://s3.wasabisys.com/jobvarejo'))
      .toEqual({ bucket: null, key: null })
    expect(extractWasabiBucketAndKey('https://s3.wasabisys.com/jobvarejo/'))
      .toEqual({ bucket: null, key: null })
  })

  it('URL sem path retorna null', () => {
    expect(extractWasabiBucketAndKey('https://s3.wasabisys.com'))
      .toEqual({ bucket: null, key: null })
  })

  it('URL invalida retorna null', () => {
    expect(extractWasabiBucketAndKey('not-a-url'))
      .toEqual({ bucket: null, key: null })
    expect(extractWasabiBucketAndKey(''))
      .toEqual({ bucket: null, key: null })
  })

  it('preserva caracteres especiais na key (encoding)', () => {
    const result = extractWasabiBucketAndKey('https://s3.wasabisys.com/bucket/folder/file%20with%20space.png')
    expect(result.bucket).toBe('bucket')
    // URL preserves encoded chars (caller decodifica se precisar)
    expect(result.key).toContain('file')
  })

  it('querystring nao interfere', () => {
    expect(extractWasabiBucketAndKey('https://s3.wasabisys.com/bucket/key.png?signature=abc&expires=123'))
      .toEqual({ bucket: 'bucket', key: 'key.png' })
  })
})

describe('extractWasabiKey', () => {
  const BUCKET = 'jobvarejo'

  it('path-style: remove bucket do inicio', () => {
    expect(extractWasabiKey('https://s3.wasabisys.com/jobvarejo/projects/u1/p1/page.json', BUCKET))
      .toBe('projects/u1/p1/page.json')
  })

  it('virtual-host: hostname tem bucket, key inclui path inteiro', () => {
    expect(extractWasabiKey('https://jobvarejo.s3.wasabisys.com/projects/u1/file.png', BUCKET))
      .toBe('projects/u1/file.png')
  })

  it('first part e bucket "tenant:bucket" (Contabo-like): remove', () => {
    expect(extractWasabiKey('https://s3.example.com/tenant:jobvarejo/path/file.png', 'jobvarejo'))
      .toBe('path/file.png')
  })

  it('URL invalida: null', () => {
    expect(extractWasabiKey('not-a-url', BUCKET)).toBeNull()
    expect(extractWasabiKey('', BUCKET)).toBeNull()
  })

  it('path vazio: null', () => {
    expect(extractWasabiKey('https://s3.wasabisys.com/', BUCKET)).toBeNull()
    expect(extractWasabiKey('https://s3.wasabisys.com', BUCKET)).toBeNull()
  })

  it('apenas bucket sem key: null', () => {
    expect(extractWasabiKey('https://s3.wasabisys.com/jobvarejo', BUCKET)).toBeNull()
    expect(extractWasabiKey('https://s3.wasabisys.com/jobvarejo/', BUCKET)).toBeNull()
  })

  it('key com URL-encoded chars decodificada', () => {
    expect(extractWasabiKey('https://s3.wasabisys.com/jobvarejo/folder/file%20space.png', BUCKET))
      .toBe('folder/file space.png')
  })

  it('configuredBucket vazio cai para "jobvarejo" default', () => {
    expect(extractWasabiKey('https://s3.wasabisys.com/jobvarejo/key.png', '' as any))
      .toBe('key.png')
  })

  it('first nao e bucket: nao remove (path-style fora do bucket configurado)', () => {
    // bucket "jobvarejo", URL com first "outro-bucket" → NAO remove
    expect(extractWasabiKey('https://s3.wasabisys.com/outro-bucket/key.png', BUCKET))
      .toBe('outro-bucket/key.png')
  })
})
