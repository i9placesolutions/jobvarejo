/**
 * A logo dinâmica pode estar em dois estados: uma imagem real ou a reserva
 * editável que aparece enquanto a loja ainda não tem logo definida.
 *
 * A reserva precisa permanecer no JSON do canvas. Por isso ela não pode usar
 * `excludeFromExport`: no Fabric essa flag remove o objeto da serialização
 * inteira, não apenas do PNG/PDF final.
 */
export const isQuickLogoPlaceholder = (object: any): boolean => {
  if (!object || typeof object !== 'object') return false

  const type = String(object?.type || '').trim().toLowerCase()
  if (type === 'image') return false

  return object?.quickLogoSlot === true ||
    String(object?.businessProfileField || '').trim().toLowerCase() === 'logo'
}
