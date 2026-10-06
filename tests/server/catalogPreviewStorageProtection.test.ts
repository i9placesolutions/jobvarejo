import { describe, expect, it, vi } from 'vitest'
import { assertClientStorageReadAllowed, assertClientStorageWriteAllowed, isServerManagedStorageKey } from '../../server/utils/storage-scope'

vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

describe('private catalog preview storage scope', () => {
  it.each(['labels', 'flyers'])('protects generated %s previews from generic storage access', (kind) => {
    const key = `projects/account-a/catalog-previews/${kind}/asset-a/revision-a.webp`

    expect(isServerManagedStorageKey(key)).toBe(true)
    expect(() => assertClientStorageReadAllowed(key)).toThrow()
    expect(() => assertClientStorageWriteAllowed(key)).toThrow()
  })
})
