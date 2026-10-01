import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ keys: [] as Array<{ key: string }> }))
vi.mock('../../server/utils/s3-object-cache', () => ({
  getCachedS3Objects: vi.fn(async () => mocks.keys)
}))

const { buildExpandedNormalizedCandidates, findBestS3Match, normalizeSearchTerm } = await import('../../server/utils/product-image-matching')

beforeEach(() => { mocks.keys = [] })

it('encontra os nomes Wasabi de Suco/Refresco e Joycolate sem escolher variante ou peso incompatível', async () => {
  const sucoKey = 'imagens/suco-adorei-sabores-80g-3HAvFVtr.png'
  const joyKey = 'imagens/manual-560-560g-achocolatado-colate-g-joy-ca0faea21a72-v2.webp'
  mocks.keys = [
    { key: 'imagens/smart-src-762e660fbb866838-v3.webp' },
    { key: 'imagens/suco-adorei-morango-30g.webp' },
    { key: 'imagens/mistura-farinha-adorei-morango-30g.webp' },
    { key: sucoKey },
    { key: 'imagens/achocolatado-joycolate-700g.webp' },
    { key: joyKey }
  ]

  const sucoMatch = await findBestS3Match({
    s3: {}, bucketName: 'bucket', prefixes: ['imagens/'],
    normalizedCandidates: buildExpandedNormalizedCandidates({ rawInputs: ['Refresco em pó Adorei sabores 80 g'], enforceWeight: true }),
    strictOnly: true
  })
  const joyMatch = await findBestS3Match({
    s3: {}, bucketName: 'bucket', prefixes: ['imagens/'],
    normalizedCandidates: buildExpandedNormalizedCandidates({ rawInputs: ['Achocolatado Joycolate 560 g'], enforceWeight: true }),
    strictOnly: true
  })

  expect(sucoMatch).toBe(sucoKey)
  expect(joyMatch).toBe(joyKey)
})

it('não deixa match exato por nome ignorar marca obrigatória em modo estrito', async () => {
  mocks.keys = [{ key: 'imagens/adorei-80g.webp' }]

  const match = await findBestS3Match({
    s3: {}, bucketName: 'bucket', prefixes: ['imagens/'],
    normalizedCandidates: [normalizeSearchTerm('Adorei 80 g')],
    brand: 'Joycolate', weight: '80g', strictOnly: true
  })

  expect(match).toBeNull()
})
