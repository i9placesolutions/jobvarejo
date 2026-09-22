/** Mudanças na lista reaplicam a receita completa, preservando conteúdo e arte. */
export const prepareProductCollectionRelayout = (cards: any[]) => {
  cards.forEach((card, index) => {
    card._zoneOrder = index
    card.__forceCardRelayout = true
    card.__lastCardRelayoutSignature = null
    card.__lastCardRelayoutAt = 0
    const children = card.getObjects?.() || []
    const images = children.filter((object: any) => String(object.type || '').toLowerCase() === 'image' &&
      (object.data?.smartType === 'product-image' || /^(smart_image|product_image|extra_image)(_|$)/.test(object.name || '')))
    // A quantidade antiga não pertence à nova composição. Mantenha somente
    // a imagem-base; a receita recria cópias conforme o espaço atual do card.
    if (images.length) {
      const source = images.find((image: any) => image.name === 'smart_image') || images[0]
      for (const image of images) if (image !== source) card.remove?.(image)
      card._productData = { ...card._productData,
        autoFillImages: card._productData?.autoFillImages !== false,
        imageFillInitialized: false }
      delete card._productData.imageFillCount
      delete card._productData.imageFillDirection
    }
    for (const object of children) {
      if (!images.includes(object) && !['smart_title', 'smart_limit', 'priceGroup', 'limitText', 'product_limit'].includes(object.name) && !object.isPriceGroup) continue
      for (const key of ['__manualTransform', '__manualTransformCardW', '__manualTransformCardH', '__manualPricePosition', '__manualPricePositionSource', '__manualScaleX', '__manualScaleY', '__manualTextWidth', '__manualTextWidthRatio']) delete object[key]
    }
    if (card._productData) {
      delete card._productData.titleTextWidth
      delete card._productData.titleTextWidthRatio
    }
  })
}
