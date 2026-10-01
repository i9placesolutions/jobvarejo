/**
 * Fabric serializes inline text styles by merging adjacent character ranges.
 * A style record made only of `undefined` values compares equal to the empty
 * previous style, so Fabric 7 tries to extend a range that was never created.
 * Those values have no visual effect and can be safely removed before toObject.
 */
export const normalizeFabricTextStylesForSerialization = (objects: any[]): void => {
  const fabricComparedTextStyleProperties = new Set([
    'fill', 'stroke', 'strokeWidth', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
    'textDecorationThickness', 'textBackgroundColor', 'deltaY', 'overline', 'underline', 'linethrough'
  ])
  const visited = new Set<any>()

  const visit = (object: any) => {
    if (!object || typeof object !== 'object' || visited.has(object)) return
    visited.add(object)

    const styles = object.styles
    if (styles && typeof styles === 'object' && !Array.isArray(styles)) {
      for (const [lineIndex, lineStyles] of Object.entries(styles) as Array<[string, any]>) {
        if (!lineStyles || typeof lineStyles !== 'object' || Array.isArray(lineStyles)) continue

        for (const [charIndex, style] of Object.entries(lineStyles) as Array<[string, any]>) {
          if (!style || typeof style !== 'object' || Array.isArray(style)) continue

          for (const [property, value] of Object.entries(style)) {
            if (value === undefined) delete style[property]
          }
          const properties = Object.keys(style)
          if (properties.length === 0) {
            delete lineStyles[charIndex]
          } else if (!properties.some(property => fabricComparedTextStyleProperties.has(property))) {
            // Fabric 7's stylesToArray ignores extra style keys such as
            // charSpacing/opacity when comparing adjacent characters. Without
            // a compared property, the first character is treated as unchanged
            // and Fabric extends a range that does not exist. deltaY: 0 is
            // neutral and forces Fabric to create the first serialized range,
            // while keeping all original runtime style properties intact.
            style.deltaY = 0
          }
        }

        if (Object.keys(lineStyles).length === 0) delete styles[lineIndex]
      }
    }

    let children: any[] = []
    try {
      children = object.getObjects?.() || object._objects || []
    } catch {
      children = object._objects || []
    }
    if (Array.isArray(children)) children.forEach(visit)
  }

  if (Array.isArray(objects)) objects.forEach(visit)
}
