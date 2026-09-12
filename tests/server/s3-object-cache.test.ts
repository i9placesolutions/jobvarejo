import { expect, it, vi } from 'vitest'
import { getCachedS3Objects } from '../../server/utils/s3-object-cache'

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
