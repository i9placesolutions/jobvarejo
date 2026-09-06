/** Endereços de assets do app não podem depender do computador que salvou a arte. */
export const portableAssetUrl = (value: string): string => {
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname) || url.hostname.endsWith('.localhost')
    const appStorage = /^\/api\/storage\/(p|proxy|download)(\/|$)/.test(url.pathname)
    if ((appStorage && (local || url.hostname === 'jobvarejo.com.br' || url.hostname === 'www.jobvarejo.com.br')) || (local && url.pathname.startsWith('/assets/'))) return url.pathname + url.search + url.hash
  } catch {}
  return value
}

export const normalizePortableAssetUrls = (root: any): void => {
  const visited = new WeakSet<object>()
  const walk = (node: any) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return
    visited.add(node)
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (typeof value === 'string') node[key] = portableAssetUrl(value)
      else if (value && typeof value === 'object') walk(value)
    }
  }
  walk(root)
}
