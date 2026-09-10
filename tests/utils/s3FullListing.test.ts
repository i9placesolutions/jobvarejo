import { expect, it, vi } from 'vitest'
import { getCachedS3Objects } from '../../server/utils/s3-object-cache'
import { collectAssetSearchPages } from '../../utils/collectAssetSearchPages'

it('percorre mais de 12 mil objetos e reaproveita o índice completo', async () => {
  const send = vi.fn(async (command) => {
    const page = Number(command.input.ContinuationToken || 0)
    return { Contents: Array.from({ length: 1000 }, (_, i) => ({ Key: `imagens/${page * 1000 + i}.png` })), IsTruncated: page < 12, NextContinuationToken: page < 12 ? String(page + 1) : undefined }
  })
  const options = { s3: { send }, bucket: 'full-list-test', prefixes: ['imagens/'] }
  const list = await getCachedS3Objects(options)
  expect(list).toHaveLength(13000)
  expect(list.at(-1)?.key).toBe('imagens/12999.png')
  expect(await getCachedS3Objects(options)).toBe(list)
  expect(send).toHaveBeenCalledTimes(13)
})
it('não aceita uma listagem truncada sem cursor como completa', async () => {
  await expect(getCachedS3Objects({ s3: { send: async () => ({ IsTruncated: true, Contents: [] }) }, bucket: 'broken-cursor', prefixes: ['imagens/'] })).rejects.toThrow('paginação incompleta')
})
it('inclui candidatos após a primeira página antes da filtragem do produto', async () => {
  const list = await collectAssetSearchPages(async cursor => cursor
    ? { items: ['produto correto'], nextCursor: null }
    : { items: Array.from({length: 200}, () => 'outro produto'), nextCursor: '200' })
  expect(list.filter(x => x === 'produto correto')).toEqual(['produto correto'])
})
it('interrompe cursores repetidos sem entrar em loop', async () => {
  await expect(collectAssetSearchPages(async () => ({ items: [], nextCursor: '1' }))).rejects.toThrow('repetiu')
})
