import { createError, getQuery, getRequestURL, readBody, type H3Event } from 'h3'
import type { UserRole } from '~/types/auth'
import {
  hasEditorPermission,
  type AccessAction,
  type AccessArea,
  type EditorPermissions
} from '../../shared/access-control'

const encartePaths = [
  '/api/projects', '/api/folders', '/api/storage', '/api/assets', '/api/asset-',
  '/api/flyer-', '/api/label-', '/api/product-', '/api/page-enhancements',
  '/api/style-references', '/api/upload', '/api/parse-products', '/api/cache-product-image',
  '/api/process-product-image', '/api/remove-image-bg', '/api/export', '/api/ai',
  '/api/generate'
]

export function accessAreaForApiPath(path: string): AccessArea | 'admin' | 'shared' | null {
  if (path.startsWith('/api/auth/') || path.startsWith('/api/access/')) return 'shared'
  if (path.startsWith('/api/admin/')) return 'admin'
  if (path === '/api/videos' || path.startsWith('/api/videos/')) return 'videos'
  if (path === '/api/cartazista' || path.startsWith('/api/cartazista/')) return 'cartazes'
  if (path === '/api/art-studio' || path.startsWith('/api/art-studio/')) return 'artes'
  if (path === '/api/radio-indoor' || path.startsWith('/api/radio-indoor/')) return 'radio'
  if (path === '/api/builder' || path.startsWith('/api/builder/')) return 'builder'
  if (path === '/api/profile' || path.startsWith('/api/profile/') || path.startsWith('/api/brands')) return 'loja'
  if (path === '/api/notifications' || path === '/api/profiles' || path === '/api/health') return 'shared'
  if (encartePaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`) || (prefix.endsWith('-') && path.startsWith(prefix)))) return 'encartes'
  return null
}

export function actionForApiRequest(method: string, path: string, body?: Record<string, unknown> | null): AccessAction {
  if (method === 'GET' || method === 'HEAD') return 'view'
  if (method === 'POST' && path === '/api/videos/brand') return 'view'
  if (method === 'POST' && path === '/api/storage/presigned' && body?.operation === 'get') return 'view'
  if (method === 'POST' && (path === '/api/projects' || path === '/api/videos/projects') && body?.id) return 'edit'
  if (method === 'DELETE' || /\/(delete|cleanup)$/.test(path)) return 'delete'
  if (method === 'PUT' || method === 'PATCH' || /\/(restore|update|recover-latest-non-empty)$/.test(path)) return 'edit'
  return 'create'
}

export async function assertRoleApiAccess(
  event: H3Event,
  role: UserRole,
  permissions: EditorPermissions
): Promise<void> {
  if (role === 'super_admin' || role === 'admin') return
  const path = getRequestURL(event).pathname.replace(/\/$/, '')
  if (path === '/api/profile' && String(getQuery(event).self || '') === '1' && event.method === 'GET') return
  const area = accessAreaForApiPath(path)
  if (area === 'shared') return
  let body: Record<string, unknown> | null = null
  if ((event.method === 'POST' && (path === '/api/projects' || path === '/api/videos/projects' || path === '/api/storage/presigned')) ||
      (role === 'user' && event.method === 'PATCH' && path === '/api/projects')) {
    const parsed = await readBody<unknown>(event)
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {}
  }
  if (role === 'user' && (area === 'encartes' || area === 'videos' || area === 'cartazes' || area === 'loja' || area === 'radio')) {
    const changesTemplateLibrary = path === '/api/projects' &&
      ((event.method === 'POST' && (body?.is_template === true || 'template_category' in (body || {}))) ||
       (event.method === 'PATCH' && ['is_template', 'template_category', 'template_subcategory'].some(key => key in (body || {}))))
    if (!changesTemplateLibrary) return
    throw createError({ statusCode: 403, statusMessage: 'A biblioteca de modelos requer acesso de editor.' })
  }
  let action = actionForApiRequest(event.method, path, body)
  if (event.method === 'POST' && (path === '/api/radio-indoor' || path.startsWith('/api/radio-indoor/'))) {
    const ambiguous = ['/api/radio-indoor', '/api/radio-indoor/members', '/api/radio-indoor/players'].includes(path)
    if (ambiguous) {
      const body = await readBody<Record<string, unknown>>(event)
      const intent = String(body?.action || 'create').trim().toLowerCase()
      action = /^(remove|revoke|delete)/.test(intent) ? 'delete'
        : /^(create|add)/.test(intent) ? 'create' : 'edit'
    }
  }
  if (role === 'editor' && area && area !== 'admin' && hasEditorPermission(permissions, area, action)) return
  throw createError({ statusCode: 403, statusMessage: 'Sem permissão para esta área.' })
}
