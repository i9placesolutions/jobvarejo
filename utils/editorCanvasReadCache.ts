/** Confirmed remote snapshots only. Draft resolution remains in useProject. */
export type CanvasReadVersion = {
  userId: string
  projectId: string
  pageId: string
  path: string
  savedAt: number
  revision?: string
}

type CacheEntry = { key: string; version: CanvasReadVersion; data: any; storedAt: number }
export interface CanvasReadCacheStore {
  get(key: string): Promise<CacheEntry | undefined>
  put(entry: CacheEntry): Promise<void>
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000
const keyFor = (v: CanvasReadVersion) => JSON.stringify([v.userId, v.projectId, v.pageId])
const validVersion = (v: CanvasReadVersion) =>
  !!v.userId && !!v.projectId && !!v.pageId && !!v.path && Number.isFinite(v.savedAt) && v.savedAt > 0
const sameVersion = (a: CanvasReadVersion, b: CanvasReadVersion) =>
  keyFor(a) === keyFor(b) && a.path === b.path && a.savedAt === b.savedAt && (a.revision || '') === (b.revision || '')
const snapshot = (data: any): any => {
  try { return structuredClone(data) }
  catch { return JSON.parse(JSON.stringify(data)) } // Vue's reactive JSON is a Proxy.
}

export const createCanvasReadCache = (store: CanvasReadCacheStore, now = Date.now) => ({
  async read(version: CanvasReadVersion): Promise<any | null> {
    if (!validVersion(version)) return null
    try {
      const entry = await store.get(keyFor(version))
      if (!entry || !sameVersion(entry.version, version) || now() - entry.storedAt > TTL_MS) return null
      // Never share mutable objects with the page/draft/asset normalization.
      return structuredClone(entry.data)
    } catch { return null }
  },
  async write(version: CanvasReadVersion, data: any): Promise<void> {
    if (!validVersion(version) || !Array.isArray(data?.objects) || !data.objects.length) return
    // A stale storage response must not become a hit for fresh DB metadata.
    if (Number(data.__savedAt || data._savedAt || data.savedAt || data.meta?.savedAt) !== version.savedAt) return
    if (data.__canvasRevision && String(data.__canvasRevision) !== (version.revision || '')) return
    try {
      await store.put({ key: keyFor(version), version: { ...version }, data: snapshot(data), storedAt: now() })
    } catch { /* Private mode, quota and IDB failures fall back to the network. */ }
  }
})

let database: Promise<IDBDatabase | null> | null = null
const openDatabase = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (database) return database
  database = new Promise(resolve => {
    const request = indexedDB.open('jobvarejo-canvas-read-cache', 1)
    let settled = false
    const finish = (db: IDBDatabase | null) => {
      if (settled) { db?.close(); return }
      settled = true
      clearTimeout(timer)
      resolve(db)
    }
    const timer = setTimeout(() => finish(null), 120)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('pages', { keyPath: 'key' })
      store.createIndex('storedAt', 'storedAt')
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = null }
      finish(request.result)
    }
    request.onerror = () => finish(null)
    request.onblocked = () => finish(null)
  })
  return database
}

const store: CanvasReadCacheStore = {
  async get(key) {
    const db = await openDatabase()
    if (!db) return undefined
    return new Promise(resolve => {
      const request = db.transaction('pages', 'readonly').objectStore('pages').get(key)
      const timer = setTimeout(() => resolve(undefined), 120)
      request.onsuccess = () => { clearTimeout(timer); resolve(request.result) }
      request.onerror = () => { clearTimeout(timer); resolve(undefined) }
    })
  },
  async put(entry) {
    const db = await openDatabase()
    if (!db) return
    await new Promise<void>(resolve => {
      const tx = db.transaction('pages', 'readwrite')
      const pages = tx.objectStore('pages')
      pages.put(entry)
      const count = pages.count()
      count.onsuccess = () => {
        let excess = count.result - 24
        if (excess <= 0) return
        const cursor = pages.index('storedAt').openKeyCursor()
        cursor.onsuccess = () => {
          const current = cursor.result
          if (!current || excess-- <= 0) return
          pages.delete(current.primaryKey)
          current.continue()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  }
}

export const canvasReadCache = createCanvasReadCache(store)
