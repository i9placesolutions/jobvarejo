import { DEFAULT_EDITOR_FONT_FAMILY, GOOGLE_WEBFONT_FAMILIES } from './font-catalog'

const catalog = new Map(GOOGLE_WEBFONT_FAMILIES.map(declaration => {
  const [family = '', variants] = declaration.split(':')
  return [family.toLowerCase(), { family, variants: (variants || '400').split(',') }]
}))

/** Lê apenas textos/estilos: não serializa o canvas nem altera objetos Fabric. */
export function collectEditorWebFonts(source: any): string[] {
  const families = new Map<string, Set<string>>()
  const visited = new WeakSet<object>()
  const add = (style: any, inherited: any = {}) => {
    const family = String(style?.fontFamily || inherited.fontFamily || DEFAULT_EDITOR_FONT_FAMILY).split(',')[0]!.trim().replace(/^['"]|['"]$/g, '')
    const spec = catalog.get(family.toLowerCase())
    if (!spec) return
    const weight = style?.fontWeight ?? inherited.fontWeight ?? 400
    const numeric = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight) || 400
    const italic = (style?.fontStyle ?? inherited.fontStyle) === 'italic'
    const desired = `${numeric}${italic ? 'italic' : ''}`
    const variants = spec.variants.filter(variant => variant.endsWith('italic') === italic)
    const available = variants.length ? variants : spec.variants.filter(variant => !variant.endsWith('italic'))
    const variant = available.includes(desired) ? desired : available.reduce((best, value) => Math.abs(parseInt(value) - numeric) < Math.abs(parseInt(best) - numeric) ? value : best, available[0] || '400')
    if (!families.has(spec.family)) families.set(spec.family, new Set())
    families.get(spec.family)!.add(variant)
  }
  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return
    visited.add(node)
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (['text', 'textbox', 'i-text', 'itext'].includes(String(node.type || '').toLowerCase())) {
      add(node)
      for (const line of Object.values(node.styles || {})) {
        for (const style of Object.values(line as object || {})) add(style, node)
      }
    }
    const children = typeof node.getObjects === 'function' ? node.getObjects() : node.objects
    if (children) visit(children)
    if (node.clipPath) visit(node.clipPath)
  }
  visit(source)
  return [...families].sort(([a], [b]) => a.localeCompare(b)).map(([family, variants]) => `${family}:${[...variants].sort().join(',')}`)
}

/** Compartilha variantes pendentes; falhas ficam disponíveis para nova tentativa. */
export function createEditorFontLoader(load: (families: string[]) => Promise<void>) {
  const loaded = new Set<string>()
  const pending = new Map<string, Promise<void>>()
  return async (declarations: string[]): Promise<void> => {
    const requests: string[] = []
    const keys: string[] = []
    const waits = new Set<Promise<void>>()
    for (const declaration of declarations) {
      const [family = '', variants = '400'] = declaration.split(':')
      const missing: string[] = []
      for (const variant of variants.split(',')) {
        const key = `${family}:${variant}`
        if (loaded.has(key)) continue
        if (pending.has(key)) waits.add(pending.get(key)!)
        else { missing.push(variant); keys.push(key) }
      }
      if (missing.length) requests.push(`${family}:${missing.join(',')}`)
    }
    if (requests.length) {
      const work = Promise.resolve().then(() => load(requests)).then(() => { keys.forEach(key => loaded.add(key)) }).finally(() => { keys.forEach(key => pending.delete(key)) })
      keys.forEach(key => pending.set(key, work))
      waits.add(work)
    }
    await Promise.all(waits)
  }
}
