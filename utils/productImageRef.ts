const readText = (value: unknown): string | null => {
  const text = String(value ?? '').trim()
  return text ? text : null
}

const readImageCandidateRef = (candidate: any): string | null => {
  if (typeof candidate === 'string') return readText(candidate)
  if (!candidate || typeof candidate !== 'object') return null

  return readText(
    candidate.image_wasabi_key ??
    candidate.imageWasabiKey ??
    candidate.imageUrl ??
    candidate.image_url ??
    candidate.image ??
    candidate.src ??
    candidate.url ??
    candidate.previewUrl ??
    candidate.thumbnailUrl ??
    candidate.key ??
    candidate.s3_key ??
    candidate.storageKey ??
    candidate.storage_key
  )
}

export const resolveProductImageRef = (product: any, seen = new WeakSet<object>()): string | null => {
  if (typeof product === 'string') return readText(product)
  if (!product || typeof product !== 'object') return null
  if (seen.has(product)) return null
  seen.add(product)

  const direct = readText(
    product.image_wasabi_key ??
    product.imageWasabiKey ??
    product.imageUrl ??
    product.image_url ??
    product.image ??
    product.src ??
    product.url ??
    product.custom_image ??
    product.customImage ??
    product.previewUrl ??
    product.thumbnailUrl ??
    product.s3_key ??
    product.storageKey ??
    product.storage_key
  )
  if (direct) return direct

  const images = Array.isArray(product.images) ? product.images : []
  for (const image of images) {
    const imageRef = readImageCandidateRef(image)
    if (imageRef) return imageRef
  }

  const nestedCandidates = [
    product.selectedImage,
    product.approvedImage,
    product.imageCandidate,
    product.imageData,
    product.productData,
    product.product,
    product.raw
  ]

  for (const candidate of nestedCandidates) {
    if (!candidate || candidate === product) continue
    const nestedRef = resolveProductImageRef(candidate, seen)
    if (nestedRef) return nestedRef
  }

  return null
}
