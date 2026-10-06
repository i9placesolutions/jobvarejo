import { describe, expect, it } from 'vitest'
import { accessAreaForApiPath, actionForApiRequest, assertRoleApiAccess } from '../../server/utils/access-policy'
import { hasEditorPermission, normalizeEditorPermissions } from '../../shared/access-control'
import type { H3Event } from 'h3'

const event = (method: string, path: string) => ({
  method,
  path,
  node: { req: { url: path, headers: { host: 'localhost' } } }
}) as unknown as H3Event

describe('níveis de acesso do JobVarejo', () => {
  it('descarta permissões desconhecidas e inclui leitura nas áreas editáveis', () => {
    const permissions = normalizeEditorPermissions({ videos: { create: true, delete: 'true' }, admin: { view: true } })
    expect(permissions).toEqual({ videos: { create: true, view: true } })
    expect(hasEditorPermission(permissions, 'videos', 'delete')).toBe(false)
    expect(normalizeEditorPermissions({ loja: { create: true, edit: true } })).toEqual({ loja: { edit: true, view: true } })
  })

  it('classifica cada área e não transforma rotas desconhecidas em acesso livre', () => {
    expect(accessAreaForApiPath('/api/videos/projects')).toBe('videos')
    expect(accessAreaForApiPath('/api/cartazista/designs')).toBe('cartazes')
    expect(accessAreaForApiPath('/api/radio-indoor/index')).toBe('radio')
    expect(accessAreaForApiPath('/api/radio-indoor')).toBe('radio')
    expect(accessAreaForApiPath('/api/projects')).toBe('encartes')
    expect(accessAreaForApiPath('/api/admin/users')).toBe('admin')
    expect(accessAreaForApiPath('/api/debug/runtime-config')).toBeNull()
    expect(actionForApiRequest('DELETE', '/api/projects')).toBe('delete')
    expect(actionForApiRequest('POST', '/api/storage/delete')).toBe('delete')
    expect(actionForApiRequest('POST', '/api/videos/brand')).toBe('view')
    expect(actionForApiRequest('POST', '/api/projects', { id: 'existing' })).toBe('edit')
    expect(actionForApiRequest('POST', '/api/projects', { name: 'new' })).toBe('create')
    expect(actionForApiRequest('POST', '/api/videos/projects', { id: 'existing' })).toBe('edit')
    expect(actionForApiRequest('POST', '/api/storage/presigned', { operation: 'get' })).toBe('view')
  })

  it('isola usuário comum e aplica as ações escolhidas para o editor no servidor', async () => {
    const onlyVideoRead = normalizeEditorPermissions({ videos: { view: true } })
    await expect(assertRoleApiAccess(event('GET', '/api/videos/projects'), 'editor', onlyVideoRead)).resolves.toBeUndefined()
    await expect(assertRoleApiAccess(event('PUT', '/api/videos/projects'), 'editor', onlyVideoRead)).rejects.toMatchObject({ statusCode: 403 })
    await expect(assertRoleApiAccess(event('GET', '/api/radio-indoor/index'), 'editor', onlyVideoRead)).rejects.toMatchObject({ statusCode: 403 })
    await expect(assertRoleApiAccess(event('GET', '/api/admin/users'), 'editor', onlyVideoRead)).rejects.toMatchObject({ statusCode: 403 })
    // Rádio Indoor é módulo do cliente (REGULAR_USER_AREAS); áreas privilegiadas continuam bloqueadas.
    await expect(assertRoleApiAccess(event('GET', '/api/radio-indoor/index'), 'user', {})).resolves.toBeUndefined()
    await expect(assertRoleApiAccess(event('GET', '/api/admin/users'), 'user', {})).rejects.toMatchObject({ statusCode: 403 })
    await expect(assertRoleApiAccess(event('GET', '/api/debug/runtime-config'), 'user', {})).rejects.toMatchObject({ statusCode: 403 })
    await expect(assertRoleApiAccess(event('GET', '/api/cartazista/designs'), 'user', {})).resolves.toBeUndefined()
    await expect(assertRoleApiAccess(event('GET', '/api/debug/runtime-config'), 'admin', {})).resolves.toBeUndefined()
  })
})
