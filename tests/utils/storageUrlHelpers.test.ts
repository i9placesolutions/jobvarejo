import { describe, it, expect } from 'vitest'
import { extractWasabiBucketAndKey } from '~/utils/storageUrlHelpers'

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
