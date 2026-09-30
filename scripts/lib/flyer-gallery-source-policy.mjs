/** Same public/owner boundary as storage reads; the offline renderer has no
 * license to resolve another account's private objects with its S3 credentials. */
export function assertFlyerGallerySourceKey(key, ownerId) {
  const value=String(key||'')
  if(!value||value.length>1024||/[\\?#\u0000-\u001f\u007f]/.test(value)||/(^|\/)\.\.?($|\/)/.test(value)||value.startsWith('/'))throw Error('Referência de storage inválida')
  const publicKey=['imagens/','uploads/','logo/'].some(prefix=>value.startsWith(prefix))
  const owned=!!ownerId&&(value.startsWith(`projects/${ownerId}/`)||new RegExp(`^${ownerId}/[a-f0-9-]{36}/(?:assets/|pages/[a-f0-9-]{36}/)`,'i').test(value))
  if(!publicKey&&!owned)throw Error('Referência privada fora da conta do modelo: '+value)
  return value
}
