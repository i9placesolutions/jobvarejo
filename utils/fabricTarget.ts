/** Fabric 7 retorna um envelope de hit-test; versões anteriores retornam o objeto. */
export const resolveFabricTarget = (result: any): any | null => {
  if (!result || typeof result !== 'object') return null
  if (typeof result.set === 'function') return result
  const target = result.target
  return target && typeof target.set === 'function' ? target : null
}
