<script setup lang="ts">
import ProductReviewModal from '~/components/ProductReviewModal.vue'
import type { SmartProduct } from '~/composables/useProductProcessor'
import { videoListBatchIssue, videoOfferFromList } from '~/shared/video-studio/list-import'
import type { VideoOffer } from '~/shared/video-studio/model'

const props = defineProps<{ remaining: number }>()
const emit = defineEmits<{ close: []; import: [offers: VideoOffer[]] }>()
// Keep the exact quick-editor review, image search and upload flow.
// Only the final adapter changes: video assets instead of canvas cards.
function validate(products: SmartProduct[]): string {
  return videoListBatchIssue(products, props.remaining)
}
const importedImages = new Map<string, { id: string; aspectRatio?: number }>()
async function importProducts(products: SmartProduct[]) {
  const issue = validate(products)
  if (issue) throw new Error(issue)
  const offers: VideoOffer[] = []
  for (const product of products) {
    const offer = videoOfferFromList(product, crypto.randomUUID())
    if (product.imageUrl) {
      const key = JSON.stringify([product.imageUrl, product.name])
      let asset = importedImages.get(key)
      if (!asset) {
        asset = await $fetch<{ id: string; aspectRatio?: number }>('/api/videos/catalog-image', {
          method: 'POST', body: { source: product.imageUrl, name: product.name }
        })
        importedImages.set(key, asset)
      }
      offer.image = asset.id
      offer.imageAspectRatio = asset.aspectRatio
    }
    offers.push(offer)
  }
  emit('import', offers)
}
</script>

<template>
  <ProductReviewModal
    :model-value="true"
    embedded
    quick-mode
    destination="video"
    :initial-auto-fill-images="true"
    :max-import-products="remaining"
    :validate-import="validate"
    :import-handler="importProducts"
    @update:model-value="!$event && emit('close')"
  />
</template>
