const PUBLIC_STORAGE_PREFIXES = ['imagens/', 'uploads/', 'logo/'] as const
const MAX_STORAGE_PATH_LENGTH = 1024

export const normalizeStoragePath = (value: unknown): string =>
  String(value || '').trim().replace(/^\/+/, '')

type StoragePathOptions = {
  allowTrailingSlash?: boolean
}

export const isValidStoragePath = (
  value: string,
  opts: StoragePathOptions = {}
): boolean => {
  const v = String(value || '').trim()
  if (!v) return false
  if (v.length > MAX_STORAGE_PATH_LENGTH) return false
  if (v.startsWith('/')) return false
  if (!opts.allowTrailingSlash && v.endsWith('/')) return false
  if (v.includes('\\')) return false
  if (v.includes('?') || v.includes('#')) return false
  if (/[\u0000-\u001F\u007F]/.test(v)) return false
  // Prevent dot-path ambiguity in object keys/prefixes.
  if (/(^|\/)\.\.?($|\/)/.test(v)) return false
  return true
}

export const getUserProjectsPrefix = (userId: string): string =>
  `projects/${String(userId || '').trim()}/`

export const isUserProjectKey = (key: string, userId: string): boolean =>
  key.startsWith(getUserProjectsPrefix(userId))

export const isProjectsKey = (key: string): boolean =>
  key.startsWith('projects/')

export const isPublicStorageKey = (key: string): boolean =>
  PUBLIC_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))

export const getProjectOwnerIdFromKey = (key: string): string | null => {
  const match = String(key || '').match(/^projects\/([^/]+)\//)
  return match?.[1] ? String(match[1]) : null
}

export const isStorageKeyAllowedForUser = (key: string, userId: string): boolean => {
  if (!key) return false
  if (isUserProjectKey(key, userId)) return true
  return isPublicStorageKey(key)
}
