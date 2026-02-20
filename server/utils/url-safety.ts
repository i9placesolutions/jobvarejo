import { isIP } from 'node:net'

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  '[::1]',
  '[::]'
])

const hasPrivateIpv4Host = (host: string): boolean => {
  const parts = host.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

const hasPrivateIpv6Host = (host: string): boolean => {
  const v = host.toLowerCase()
  if (v === '::1' || v === '::' || v === '0:0:0:0:0:0:0:1') return true
  if (v.startsWith('fc') || v.startsWith('fd')) return true // Unique local (fc00::/7)
  if (v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')) return true // Link local (fe80::/10)

  if (v.startsWith('::ffff:')) {
    const mapped = v.slice('::ffff:'.length)
    return hasPrivateIpv4Host(mapped)
  }
  return false
}

const hasPrivateHost = (hostname: string): boolean => {
  const rawHost = String(hostname || '').trim().toLowerCase()
  if (!rawHost) return true
  if (LOCAL_HOSTS.has(rawHost)) return true
  if (rawHost.endsWith('.local') || rawHost.endsWith('.localhost') || rawHost.endsWith('.internal')) return true

  const host = rawHost.replace(/^\[|\]$/g, '')
  const ipType = isIP(host)
  if (ipType === 4) return hasPrivateIpv4Host(host)
  if (ipType === 6) return hasPrivateIpv6Host(host)
  return false
}

export const assertSafeExternalHttpUrl = (raw: unknown, opts: { maxLength?: number } = {}): string => {
  const value = String(raw ?? '').trim()
  const maxLength = Number.isFinite(opts.maxLength) ? Math.max(32, Number(opts.maxLength)) : 2048
  if (!value) throw new Error('url required')
  if (value.length > maxLength) throw new Error('url too long')

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('invalid url')
  }

  const protocol = String(parsed.protocol || '').toLowerCase()
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed')
  }

  if (hasPrivateHost(parsed.hostname)) {
    throw new Error('Private/local URLs are not allowed')
  }

  // Hash fragment is irrelevant for server fetch and can be safely dropped.
  parsed.hash = ''
  return parsed.toString()
}
