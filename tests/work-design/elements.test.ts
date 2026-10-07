import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { owner, other } from './fixtures'
const runtime = vi.hoisted(() => ({ objects: new Map<string, Buffer>(), prefixes: [] as string[] }))
vi.mock('../../server/utils/s3', () => ({ getS3Client: () => ({ send: async (command: any) => {
  const prefix = command.input.Prefix; runtime.prefixes.push(prefix)
  return { Contents: [...runtime.objects.keys()].filter(k => k.startsWith(prefix)).map(Key => ({ Key })), IsTruncated: false }
} }) }))
vi.mock('../../server/utils/work-design/storage', async original => ({ ...await original<any>(),
  workBucket: () => 'fixture',
  readWorkBytes: async (key: string) => { const bytes = runtime.objects.get(key); if (!bytes) throw new Error('Arquivo não salvo'); return bytes },
  writeWorkBytes: async (key: string, bytes: Buffer) => { runtime.objects.set(key, Buffer.from(bytes)) }
}))
import { listWorkElements, saveWorkElement, assertWorkSeal } from '../../server/utils/work-design/elements'
import { assertClientStorageReadAllowed, assertClientStorageWriteAllowed } from '../../server/utils/storage-scope'
import { createError } from 'h3'
beforeAll(() => vi.stubGlobal('createError', createError))
afterAll(() => vi.unstubAllGlobals())
const metadata = { name: 'Fundo reutilizável', theme: 'Tema de teste', role: 'background' as const,
  palette: ['#083A9D', '#FFD215'], formats: ['stories' as const, 'feed' as const] }
describe('biblioteca privada de peças Work', () => {
  it('salva a peça, encontra em outro pedido e não duplica retentativa', async () => {
    const account = randomUUID(), asset = { key: `projects/${account}/work-assets/library/background.png`, width: 1080, height: 1920 }
    expect(await listWorkElements(account, 'background', metadata.theme)).toEqual([])
    const saved = await saveWorkElement(account, asset, metadata)
    const found = await listWorkElements(account, 'background', metadata.theme)
    expect(found).toHaveLength(1); expect(found[0]).toMatchObject({ ...metadata, ...asset, id: saved.id })
    await saveWorkElement(account, asset, metadata)
    expect(await listWorkElements(account, 'background', metadata.theme)).toHaveLength(1)
  })
  it('gravações de peças diferentes não perdem elementos e contas não compartilham biblioteca', async () => {
    const account = randomUUID(), foreign = randomUUID()
    await Promise.all(['a', 'b'].map(name => saveWorkElement(account,
      { key: `projects/${account}/work-assets/library/${name}.png` }, { ...metadata, name })))
    expect(await listWorkElements(account, 'background', metadata.theme)).toHaveLength(2)
    expect(await listWorkElements(foreign, 'background', metadata.theme)).toEqual([])
    await expect(saveWorkElement(foreign, { key: `projects/${account}/work-assets/library/a.png` }, metadata)).rejects.toThrow(/escopo/)
  })
  it('referências são internas e o catálogo só inclui recursos da conta', async () => {
    expect((await listWorkElements(owner, 'reference')).length).toBeGreaterThan(0)
    expect(await listWorkElements(other, 'reference')).toEqual([])
    expect(runtime.prefixes.every(p => /^projects\/[a-f0-9-]+\/work-elements\//.test(p))).toBe(true)
  })
  it('um novo selo passa a ser selecionável; imagens avulsas não viram selo', async () => {
    const account = randomUUID(), asset = { key: `projects/${account}/work-assets/library/seal.png` }
    await saveWorkElement(account, asset, { ...metadata, role: 'seal' })
    await expect(assertWorkSeal(account, asset.key)).resolves.toBeUndefined()
    await expect(assertWorkSeal(account, `projects/${account}/work-assets/library/other.png`)).rejects.toThrow(/indisponível/)
  })
  it('APIs genéricas não alteram nem expõem os registros internos da biblioteca', () => {
    const key = `projects/${owner}/work-elements/background/theme/element.json`
    expect(() => assertClientStorageWriteAllowed(key)).toThrow(/gerenciado/)
    expect(() => assertClientStorageReadAllowed(key)).toThrow(/leitura direta/)
    expect(() => assertClientStorageReadAllowed(`projects/${owner}/work-assets/library/element.png`)).not.toThrow()
  })
})
