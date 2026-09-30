import manifest from '../data/flyer-gallery-previews.json'

type GalleryAsset = { revision: string; key: string; sha256: string; bytes: number; sourcePolicyVersion?: number }
type GalleryManifest = { version: number; assets: Record<string, GalleryAsset> }

/** Only offline-rendered, neutral thumbnails of the exact saved revision qualify.
 * The caller must first authorize access to the project/library. */
export const getFlyerGalleryPreviewKey = (
  projectId: unknown,
  revision: unknown,
  catalog: GalleryManifest = manifest as GalleryManifest
): string | null => {
  const asset = catalog.version === 1 ? catalog.assets[String(projectId || '')] : null
  if (!asset || asset.sourcePolicyVersion !== 1 || !/^[a-f0-9]{64}$/.test(asset.sha256) || !(asset.bytes > 0)) return null
  const date = revision instanceof Date ? revision : new Date(String(revision || ''))
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== asset.revision) return null
  if (asset.key !== `imagens/catalogo-encartes/${asset.sha256}.webp`) return null
  return asset.key
}
