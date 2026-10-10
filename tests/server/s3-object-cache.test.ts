import { expect, it, vi } from 'vitest'
import { getCachedS3Objects, recordUploadedS3Object } from '../../server/utils/s3-object-cache'

it('reaproveita resultado vazio em 20 consultas consecutivas', async () => {
  const s3 = { send: vi.fn().mockResolvedValue({ Contents: [] }) }
  for (let i = 0; i < 20; i++) await getCachedS3Objects({ s3, bucket: 'empty-cache', prefixes: ['imagens/'] })
  expect(s3.send).toHaveBeenCalledOnce()
})

it('entrega uploads confirmados a todos os consumidores da mesma listagem', async () => {
  let finish!: (response: any) => void
  const s3 = { send: vi.fn(() => new Promise(resolve => { finish = resolve })) }
  const options = { s3, bucket: 'shared-upload-race', prefixes: ['imagens/'] }
  const first = getCachedS3Objects(options)
  const second = getCachedS3Objects(options)
  recordUploadedS3Object(options.bucket, { key: 'imagens/nova.png' })
  finish({ Contents: [] })
  const [a, b] = await Promise.all([first, second])
  expect(a).toEqual(b)
  expect(b.map(item => item.key)).toContain('imagens/nova.png')
})

it('compartilha também o fallback quando uma atualização forçada falha', async () => {
  const s3 = { send: vi.fn().mockResolvedValueOnce({ Contents: [{ Key: 'imagens/a.png' }] }) }
  const options = { s3, bucket: 'shared-stale-error', prefixes: ['imagens/'] }
  await getCachedS3Objects(options)
  let fail!: (reason: unknown) => void
  s3.send.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
  const first = getCachedS3Objects({ ...options, forceRefresh: true })
  const second = getCachedS3Objects({ ...options, forceRefresh: true })
  const results = Promise.allSettled([first, second])
  fail(new Error('temporary offline'))
  expect(await results).toEqual([
    { status: 'fulfilled', value: [{ key: 'imagens/a.png', size: undefined, lastModified: undefined }] },
    { status: 'fulfilled', value: [{ key: 'imagens/a.png', size: undefined, lastModified: undefined }] }
  ])
})

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
