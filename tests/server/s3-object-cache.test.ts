import { expect, it, vi } from 'vitest'
import { getCachedS3Objects, recordUploadedS3Object } from '../../server/utils/s3-object-cache'

it('compartilha a listagem em andamento até entre atualizações forçadas', async () => {
  let finish!: (response: any) => void
  const s3 = { send: vi.fn((_command: unknown, _options: unknown) => new Promise(resolve => { finish = resolve })) }
  const options = { s3, bucket: 'test-dedup-refresh', prefixes: ['imagens/'], forceRefresh: true }
  const first = getCachedS3Objects(options)
  const second = getCachedS3Objects(options)
  expect(s3.send).toHaveBeenCalledTimes(1)
  expect(s3.send.mock.calls[0]?.[1]).toEqual({ abortSignal: expect.any(AbortSignal) })
  finish({ Contents: [{ Key: 'imagens/a.png' }], IsTruncated: false })
  expect(await first).toEqual(await second)
})

it('inclui upload imediatamente sem esperar expirar a listagem e respeita o escopo', async () => {
  const s3 = { send: vi.fn().mockResolvedValue({ Contents: [{ Key: 'imagens/antiga.png' }] }) }
  const options = { s3, bucket: 'upload-ready', prefixes: ['imagens/'], excludeKeyPrefixes: ['imagens/privado/'] }
  await getCachedS3Objects(options)
  recordUploadedS3Object(options.bucket, { key: 'imagens/nova.png', size: 123 })
  recordUploadedS3Object('outro-bucket', { key: 'imagens/outra.png' })
  recordUploadedS3Object(options.bucket, { key: 'imagens/privado/x.png' })
  expect((await getCachedS3Objects(options)).map(item => item.key)).toEqual(['imagens/antiga.png', 'imagens/nova.png'])
  expect(s3.send).toHaveBeenCalledTimes(1)
})

it('não perde o upload quando uma listagem anterior termina depois do PUT', async () => {
  let finish!: (response: any) => void
  const s3 = { send: vi.fn(() => new Promise(resolve => { finish = resolve })) }
  const options = { s3, bucket: 'upload-race', prefixes: ['imagens/'] }
  const listing = getCachedS3Objects(options)
  recordUploadedS3Object(options.bucket, { key: 'imagens/nova.png' })
  finish({ Contents: [{ Key: 'imagens/antiga.png' }] })
  expect((await listing).map(item => item.key)).toContain('imagens/nova.png')
  expect((await getCachedS3Objects(options)).map(item => item.key)).toContain('imagens/nova.png')
})
