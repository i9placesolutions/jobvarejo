import { describe, expect, it } from 'vitest'
import { assertSuperAdminRole } from '../../server/utils/role-guard'

describe('super admin role guard', () => {
  it('permits only the super_admin role', () => {
    expect(() => assertSuperAdminRole('super_admin')).not.toThrow()

    for (const role of ['admin', 'user', '', null, undefined]) {
      let error: unknown
      try {
        assertSuperAdminRole(role)
      } catch (caught) {
        error = caught
      }
      expect(error).toMatchObject({ statusCode: 403 })
    }
  })
})
