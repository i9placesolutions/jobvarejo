/** Keep the original paint so removing a color remains reversible after reload. */
export const rememberQuickDefaultColor = (object: any, property: 'fill' | 'stroke'): void => {
  if (Object.hasOwn(object._quickDefaultColors || {}, property)) return
  const color = object[property]
  if (typeof color !== 'string' || isEmptyQuickPaint(color)) return
  object._quickDefaultColors = { ...object._quickDefaultColors, [property]: color }
}

export const isEmptyQuickPaint = (value: unknown): boolean => value == null ||
  /^(?:\s*|transparent|none|rgba\(0,\s*0,\s*0,\s*0\))$/i.test(String(value).trim())

export const resolveQuickDefaultColor = (object: any, property: 'fill' | 'stroke'): string => {
  const original = object._quickDefaultColors?.[property]
  if (typeof original === 'string' && !isEmptyQuickPaint(original)) return original
  if (typeof object[property] === 'string' && !isEmptyQuickPaint(object[property])) return object[property]
  return '#172033'
}

/** Whole-text paint must also replace any per-character override. */
export const setQuickTextPaint = (object: any, color: string): void => {
  if (!['text', 'i-text', 'textbox'].includes(String(object.type).toLowerCase())) return
  for (const line of Object.values(object.styles || {}) as any[]) {
    for (const style of Object.values(line) as any[]) delete style.fill
  }
  object.set?.('fill', color)
}
