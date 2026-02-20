export const stringifyJsonbParam = (value: unknown): string => {
  const serialized = JSON.stringify(value)
  if (typeof serialized !== 'string') {
    throw new Error('Value is not JSON-serializable for jsonb column')
  }
  return serialized
}

const sanitizeStringForPostgresJson = (input: string): string => {
  if (!input) return input
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)

    // Postgres text/jsonb cannot contain NUL byte.
    if (code === 0x0000) continue

    // High surrogate handling.
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(i + 1)
      if (Number.isFinite(next) && next >= 0xdc00 && next <= 0xdfff) {
        out += input.charAt(i) + input.charAt(i + 1)
        i += 1
      }
      // Drop lone high surrogate.
      continue
    }

    // Drop lone low surrogate.
    if (code >= 0xdc00 && code <= 0xdfff) continue

    out += input.charAt(i)
  }
  return out
}

const sanitizeJsonForPostgresJsonb = (value: unknown): unknown => {
  if (typeof value === 'string') return sanitizeStringForPostgresJson(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonForPostgresJsonb(item))
  if (!value || typeof value !== 'object') return value

  const output: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    output[k] = sanitizeJsonForPostgresJsonb(v)
  }
  return output
}

export const parseAndStringifyJsonbParam = (
  value: unknown,
  fieldName: string
): string => {
  let normalized: unknown = value

  if (typeof normalized === 'string') {
    const trimmed = normalized.trim()
    if (!trimmed) {
      throw createError({
        statusCode: 400,
        statusMessage: `${fieldName} cannot be an empty string`
      })
    }
    try {
      normalized = JSON.parse(trimmed)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: `${fieldName} must be valid JSON`
      })
    }
  }

  try {
    const sanitized = sanitizeJsonForPostgresJsonb(normalized)
    return stringifyJsonbParam(sanitized)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be valid JSON`
    })
  }
}
