import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createCanvasReadCache, type CanvasReadVersion, type CanvasReadCacheStore } from '../../utils/editorCanvasReadCache'

const version: CanvasReadVersion = { userId: 'u1', projectId: 'p1', pageId: 'a', path: 'canvas.json', savedAt: 100, revision: 'r1' }
const data = () => ({ __savedAt: 100, __canvasRevision: 'r1', objects: [{ type: 'image', src: 'original.png', width: 4096 }] })
const makeCache = () => {
  const entries = new Map<string, any>()
  const store: CanvasReadCacheStore = { get: async key => entries.get(key), put: async entry => { entries.set(entry.key, entry) } }
  return createCanvasReadCache(store, () => 1000)
}

describe('confirmed canvas read cache', () => {
  it('seeds a confirmed save from the reactive project without sharing mutable proxies', async () => {
    const cache = makeCache()
    const page = reactive(data())
    await cache.write(version, page)
    page.objects[0]!.src = 'later-edit.png'
    expect(await cache.read(version)).toEqual(data())
  })
  it('reuses exact remote version and keeps original pixels/URLs independent of live edits', async () => {
    const cache = makeCache()
    const original = data()
    await cache.write(version, original)
    original.objects[0]!.src = 'edited.png'
    const hit = await cache.read(version)
    expect(hit).toEqual(data())
    hit.objects[0].width = 10
    expect(await cache.read(version)).toEqual(data())
  })
  it.each([
    { userId: 'u2' }, { projectId: 'p2' }, { pageId: 'b' },
    { path: 'restore.json' }, { savedAt: 101 }, { revision: 'restored' },
    { savedAt: 0 }, { userId: '' }
  ])('invalidates changes to identity/version %j', async patch => {
    const cache = makeCache()
    await cache.write(version, data())
    expect(await cache.read({ ...version, ...patch })).toBeNull()
  })
  it('does not cache stale storage or draft timestamps under current DB version', async () => {
    const cache = makeCache()
    await cache.write(version, { ...data(), __savedAt: 99 })
    await cache.write(version, { ...data(), __canvasRevision: 'old' })
    expect(await cache.read(version)).toBeNull()
  })
  it('fails open for private mode/quota errors and expires old snapshots', async () => {
    const broken = createCanvasReadCache({ get: async () => { throw Error('blocked') }, put: async () => { throw Error('quota') } })
    expect(await broken.read(version)).toBeNull()
    await expect(broken.write(version, data())).resolves.toBeUndefined()
    let clock = 0
    const entries = new Map<string, any>()
    const cache = createCanvasReadCache({ get: async key => entries.get(key), put: async e => { entries.set(e.key, e) } }, () => clock)
    await cache.write(version, data())
    clock = 8 * 24 * 60 * 60 * 1000
    expect(await cache.read(version)).toBeNull()
  })
})
