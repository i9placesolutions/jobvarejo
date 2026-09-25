const TRAILING_COPY_SUFFIX = /\s*\(\s*c[oó]pia\s*\)\s*$/iu

export const stripPageCopySuffixes = (value: unknown): string => {
  let name = String(value ?? '').trim()
  while (TRAILING_COPY_SUFFIX.test(name)) {
    name = name.replace(TRAILING_COPY_SUFFIX, '').trim()
  }
  return name
}

export const normalizePageCopyName = (value: unknown, fallback = 'Página'): string => {
  const original = String(value ?? '').trim()
  const base = stripPageCopySuffixes(original)
  if (!base) return fallback
  return base === original ? original : `${base} (cópia)`
}

export const appendPageCopySuffix = (
  value: unknown,
  fallback = 'Página',
  suffix = 'cópia'
): string => {
  const base = stripPageCopySuffixes(value) || fallback
  const normalizedSuffix = String(suffix || 'cópia').trim() || 'cópia'
  return `${base} (${normalizedSuffix})`
}
