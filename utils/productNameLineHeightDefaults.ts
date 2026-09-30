import { isProductNameText } from './productNameTypographyScope'

export const PRODUCT_NAME_LINE_HEIGHT = 0.95
export const PRODUCT_NAME_LINE_HEIGHT_VERSION = 1
const isLegacyDefault = (value: unknown) => value == null || Math.abs(Number(value) - 1.05) < 0.000001

/** Migra só o antigo padrão, antes de o Fabric/normalizador mesclar defaults. */
export const upgradeProductNameLineHeightDefaults = (objects: any[]): number => {
  const nodes: any[] = []
  const parents = new Map<any, any>()
  const visit = (object: any, parent?: any) => {
    if (!object || parents.has(object)) return
    parents.set(object, parent)
    nodes.push(object)
    if (Array.isArray(object.objects)) object.objects.forEach((child: any) => visit(child, object))
  }
  objects.forEach(object => visit(object))
  const zones = new Map(nodes.filter(node => node.isProductZone || node.isGridZone)
    .map(zone => [String(zone._customId || zone.id || ''), zone]))
  const legacyZones = new Set<any>()
  for (const zone of zones.values()) {
    const styles = zone._zoneGlobalStyles || {}
    if (styles.prodNameLineHeightDefaultVersion >= PRODUCT_NAME_LINE_HEIGHT_VERSION) continue
    if (isLegacyDefault(styles.prodNameLineHeight)) legacyZones.add(zone)
    zone._zoneGlobalStyles = {
      ...styles,
      ...(legacyZones.has(zone) ? { prodNameLineHeight: PRODUCT_NAME_LINE_HEIGHT } : {}),
      prodNameLineHeightDefaultVersion: PRODUCT_NAME_LINE_HEIGHT_VERSION
    }
    if (zone._zoneStateSnapshot?.globalStyles) {
      zone._zoneStateSnapshot.globalStyles = { ...zone._zoneStateSnapshot.globalStyles, ...zone._zoneGlobalStyles }
    }
  }
  let changed = 0
  for (const title of nodes.filter(isProductNameText)) {
    if (title.__manualTypography || !isLegacyDefault(title.lineHeight)) continue
    let card = parents.get(title)
    while (card && !card.isProductCard && !card.isSmartObject && !card._productData) card = parents.get(card)
    if (card?._cardStyleOverrides?.prodNameLineHeight != null) continue
    const zone = zones.get(String(card?.parentZoneId || ''))
    if (zone && !legacyZones.has(zone)) continue
    title.lineHeight = PRODUCT_NAME_LINE_HEIGHT
    changed += 1
  }
  return changed
}
