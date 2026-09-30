import { describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { assertClientStorageReadAllowed, assertClientStorageWriteAllowed, isServerManagedStorageKey, isStorageKeyAllowedForUser } from '../../server/utils/storage-scope'

describe('server-managed flyer gallery assets', () => {
  it('preserves public reading but denies common uploads and deletion of catalog objects', () => {
    vi.stubGlobal('createError',createError)
    try {
      const key=`imagens/catalogo-encartes/${'a'.repeat(64)}.webp`
      expect(isStorageKeyAllowedForUser(key,'any-user')).toBe(true)
      expect(()=>assertClientStorageReadAllowed(key)).not.toThrow()
      expect(isServerManagedStorageKey(key)).toBe(true)
      expect(()=>assertClientStorageWriteAllowed(key)).toThrow()
      try{assertClientStorageWriteAllowed(key)}catch(error:any){expect(error.statusCode).toBe(403)}
      expect(()=>assertClientStorageWriteAllowed('imagens/user-product.webp')).not.toThrow()
    } finally { vi.unstubAllGlobals() }
  })
})
