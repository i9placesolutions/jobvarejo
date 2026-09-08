type ReplaceObjectInContextOptions = {
  canvas: any
  original: any
  replacement: any
  safeAddWithUpdate: (obj: any) => void
}

export const replaceObjectInContext = (opts: ReplaceObjectInContextOptions): boolean => {
  if (!opts.canvas || !opts.original || !opts.replacement) return false

  // FIX: capture the z-index BEFORE remove(), because remove() mutates the
  // internal objects array and the previously captured index becomes stale
  // (off-by-one for all objects after the removed one).
  const parent = opts.original.group
  if (parent && typeof parent.getObjects === 'function') {
    const siblings = parent.getObjects() || []
    const index = siblings.indexOf(opts.original)
    try { parent.remove?.(opts.original) } catch {}
    if (typeof (parent as any).insertAt === 'function' && index >= 0) {
      // After remove, the array shifted — but insertAt(index) is correct
      // because Fabric.js insertAt inserts AT that position (not after).
      (parent as any).insertAt(index, opts.replacement)
    } else {
      parent.add?.(opts.replacement)
    }
    opts.safeAddWithUpdate(parent)
    parent.setCoords?.()
    // FIX: dispose the old object to free its internal caches (_cacheCanvas, etc.)
    try { opts.original.dispose?.() } catch {}
    return true
  }

  const objects = opts.canvas.getObjects()
  const index = objects.indexOf(opts.original)
  try { opts.canvas.remove(opts.original) } catch {}
  if (typeof (opts.canvas as any).insertAt === 'function' && index >= 0) {
    (opts.canvas as any).insertAt(index, opts.replacement)
  } else {
    opts.canvas.add(opts.replacement)
  }
  // FIX: dispose the old object to free its internal caches
  try { opts.original.dispose?.() } catch {}
  return true
}

type ConvertStaticTextToITextOptions = {
  canvas: any
  fabric: any
  obj: any
  canvasCustomProps: string[]
  safeAddWithUpdate: (obj: any) => void
  syncObjectFrameClip: (obj: any) => void
  refreshCanvasObjects: () => void
}

export const convertStaticTextToIText = (opts: ConvertStaticTextToITextOptions): any => {
  const obj = opts.obj
  if (!opts.canvas || !opts.fabric?.IText || String(obj?.type || '').toLowerCase() !== 'text') return obj

  const includeProps = Array.from(
    new Set<string>([
      ...((Array.isArray(opts.canvasCustomProps) ? opts.canvasCustomProps : []) as any),
      'data',
      'styles'
    ])
  )

  const serialized = typeof obj?.toObject === 'function'
    ? obj.toObject(includeProps as any)
    : null

  const textValue = String(serialized?.text ?? obj?.text ?? '')
  const nextOptions: any = { ...(serialized || {}) }
  delete nextOptions.type
  delete nextOptions.version
  delete nextOptions.canvas
  delete nextOptions.group
  delete nextOptions.clipPath
  delete nextOptions._objects
  delete nextOptions.objects

  let next: any = null
  try {
    next = new opts.fabric.IText(textValue, nextOptions)
  } catch (e) {
    console.warn('[rich-text] Falha ao converter text -> i-text:', e)
    return obj
  }

  if (obj?.styles && !next.styles) {
    try {
      next.styles = JSON.parse(JSON.stringify(obj.styles))
    } catch {
      // FIX: previously the catch fallback assigned the same reference
      // (`next.styles = obj.styles`), meaning both old and new objects
      // shared the exact same styles object — mutating one would mutate
      // the other, corrupting undo/redo history entries.
      // Instead, create a shallow copy of each line's style map.
      try {
        const copy: any = {}
        for (const lineIdx of Object.keys(obj.styles)) {
          copy[lineIdx] = { ...obj.styles[lineIdx] }
        }
        next.styles = copy
      } catch {
        next.styles = {}
      }
    }
  }

  try {
    ((opts.canvasCustomProps as unknown as string[]) || []).forEach((key: string) => {
      if (obj?.[key] !== undefined) (next as any)[key] = obj[key]
    })
  } catch {
    // ignore
  }

  ;['data', 'visible', 'evented', 'selectable', 'hasControls', 'hasBorders', 'hoverCursor', 'moveCursor', 'excludeFromExport']
    .forEach((key) => {
      if (obj?.[key] !== undefined) (next as any)[key] = obj[key]
    })

  const replaced = replaceObjectInContext({
    canvas: opts.canvas,
    original: obj,
    replacement: next,
    safeAddWithUpdate: opts.safeAddWithUpdate
  })
  if (!replaced) return obj

  next.initDimensions?.()
  next.setCoords?.()
  if (next.parentFrameId) {
    try { opts.syncObjectFrameClip(next) } catch {}
  }

  try {
    opts.canvas.setActiveObject(next)
  } catch {
    try {
      if (next.group) opts.canvas.setActiveObject(next.group)
    } catch {}
  }

  opts.canvas.requestRenderAll()
  opts.refreshCanvasObjects()
  return next
}

type ApplySelectionTextStyleOptions = {
  obj: any
  prop: string
  value: any
  getTextSelectionRange: (obj: any) => { start: number; end: number; length: number } | null
  safeAddWithUpdate: (obj: any) => void
  /**
   * Quando o objeto tem estilos inline legados, uma edicao feita com apenas o
   * objeto selecionado deve atualizar o texto inteiro. Sem isso, o `styles`
   * por caractere continua vencendo a propriedade-base e a mudanca nao aparece.
   */
  applyWholeTextWhenNoSelection?: boolean
}

const getWholeTextRange = (obj: any): { start: number; end: number; length: number } | null => {
  const textLength = String(obj?.text ?? '').length
  if (textLength <= 0) return null
  return { start: 0, end: textLength, length: textLength }
}

const hasInlineTextStyles = (obj: any): boolean => {
  const styles = obj?.styles
  if (!styles || typeof styles !== 'object') return false

  return Object.keys(styles).some((lineIndex) => {
    const lineStyles = styles[lineIndex]
    if (!lineStyles || typeof lineStyles !== 'object') return false
    return Object.keys(lineStyles).some((charIndex) => {
      const charStyles = lineStyles[charIndex]
      return !!charStyles && typeof charStyles === 'object' && Object.keys(charStyles).length > 0
    })
  })
}

export const applySelectionTextStyle = (opts: ApplySelectionTextStyleOptions): boolean => {
  const obj = opts.obj
  const selectionRange = opts.getTextSelectionRange(obj)
  const applyingWholeText = !selectionRange && !!opts.applyWholeTextWhenNoSelection && hasInlineTextStyles(obj)
  const range = selectionRange || (applyingWholeText ? getWholeTextRange(obj) : null)
  if (!range || typeof obj?.setSelectionStyles !== 'function') return false

  const patch: Record<string, any> = {}
  if (opts.prop === 'fill') patch.fill = opts.value
  if (opts.prop === 'fontSize') {
    const nextSize = Number(opts.value)
    if (!Number.isFinite(nextSize) || nextSize <= 0) return false
    patch.fontSize = nextSize
  }
  if (opts.prop === 'fontFamily') patch.fontFamily = String(opts.value || '')
  if (opts.prop === 'fontWeight') patch.fontWeight = opts.value
  if (opts.prop === 'fontStyle') patch.fontStyle = opts.value
  if (opts.prop === 'underline') patch.underline = !!opts.value
  if (opts.prop === 'linethrough') patch.linethrough = !!opts.value
  if (opts.prop === 'stroke') patch.stroke = opts.value
  if (opts.prop === 'strokeWidth') {
    const nextStrokeWidth = Number(opts.value)
    if (!Number.isFinite(nextStrokeWidth) || nextStrokeWidth < 0) return false
    patch.strokeWidth = nextStrokeWidth
  }
  if (!Object.keys(patch).length) return false

  try {
    // Mantenha a propriedade-base alinhada quando a alteracao foi feita no
    // objeto inteiro. Assim, novos caracteres e a proxima serializacao nao
    // voltam para o valor antigo depois que os estilos inline forem removidos.
    if (applyingWholeText) {
      if (typeof obj?.set === 'function') obj.set(patch)
      else Object.assign(obj, patch)
    }
    obj.setSelectionStyles(patch, range.start, range.end)
  } catch {
    return false
  }

  obj.initDimensions?.()
  obj.setCoords?.()
  obj.dirty = true
  if (obj.group) opts.safeAddWithUpdate(obj.group)
  else opts.safeAddWithUpdate(obj)
  return true
}
