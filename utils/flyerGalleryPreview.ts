const isLogo = (object: any): boolean => object?.quickLogoSlot === true ||
  String(object?.businessProfileField || '').toLowerCase() === 'logo' ||
  /^(?:header|footer|account|business)-(?:dynamic-)?logo(?:-|$)/i.test(String(object?.name || ''))
const isAccountContact = (object: any): boolean => {
  const field = String(object?.businessProfileField || '').trim().toLowerCase()
  return (!!field && field !== 'logo') ||
    /^(?:header|footer|account|business)-(?:dynamic-)?(?:whatsapp|address|phone|instagram|contact|email)(?:-|$)/i.test(String(object?.name || ''))
}

/** Gallery previews must never show contact values from the template owner. */
export const removeFlyerAccountContacts = (source: any): any => {
  const cloned = JSON.parse(JSON.stringify(source || {}))
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object' || !Array.isArray(node.objects)) return
    node.objects = node.objects.filter((object: any) => !isAccountContact(object))
    node.objects.forEach(visit)
  }
  visit(cloned)
  return cloned
}

/** Neutral shared thumbnails also remove explicitly identified account logos. */
export const prepareNeutralFlyerCanvas = (source: any): any => {
  const cloned = removeFlyerAccountContacts(source)
  const ids = new Set<string>()
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object' || !Array.isArray(node.objects)) return
    node.objects = node.objects.filter((object: any) => {
      if (!isLogo(object)) return true
      for (const value of [object._customId, object.quickLogoBackdropId]) if (value) ids.add(String(value))
      return false
    })
    node.objects.forEach(visit)
  }
  const backdrops = (node: any): void => {
    if (!node || typeof node !== 'object' || !Array.isArray(node.objects)) return
    node.objects = node.objects.filter((object: any) => object.quickLogoBackdrop !== true &&
      !ids.has(String(object._customId || '')) && !ids.has(String(object.quickLogoBackdropOwnerId || '')))
    node.objects.forEach(backdrops)
  }
  visit(cloned)
  backdrops(cloned)
  return cloned
}
