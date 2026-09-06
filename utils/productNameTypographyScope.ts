export const isProductNameText = (object: any): boolean =>
  ['text', 'i-text', 'textbox'].includes(String(object?.type || '').toLowerCase()) &&
  (object?.name === 'smart_title' || object?.data?.smartType === 'product-name')

export const collectProductNameTexts = (root: any): any[] => {
  const names: any[] = []
  const seen = new Set<any>()
  const visit = (object: any) => {
    if (!object || seen.has(object)) return
    seen.add(object)
    if (isProductNameText(object)) names.push(object)
    object.getObjects?.().forEach(visit)
  }
  visit(root)
  return names
}
