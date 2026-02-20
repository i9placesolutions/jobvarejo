export const stringifyJsonbParam = (value: unknown): string => {
  const serialized = JSON.stringify(value)
  if (typeof serialized !== 'string') {
    throw new Error('Value is not JSON-serializable for jsonb column')
  }
  return serialized
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
    return stringifyJsonbParam(normalized)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} must be valid JSON`
    })
  }
}
