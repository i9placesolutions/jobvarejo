/** Mantém máscaras de grupos fora do canvas de destino, inclusive com sombras. */
export const installGroupClipCacheGuard = (Group: any): void => {
  const prototype = Group?.prototype
  if (!prototype || prototype.__groupClipCacheGuard) return
  const originalShouldCache = prototype.shouldCache
  prototype.shouldCache = function () {
    if (this.clipPath) {
      this.ownCaching = true
      return true
    }
    return originalShouldCache.call(this)
  }
  Object.defineProperty(prototype, '__groupClipCacheGuard', { value: true })
}
