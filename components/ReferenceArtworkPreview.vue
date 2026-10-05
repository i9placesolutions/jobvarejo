<script setup lang="ts">
import type { RetailReferenceArtwork, ReferenceArtworkBox } from '~/shared/retail-reference-artwork'
const props = defineProps<{ artwork: RetailReferenceArtwork; title: string }>()
const box = (b: ReferenceArtworkBox) => ({ left: `${b[0] * 100}%`, top: `${b[1] / props.artwork.headerBottom * 100}%`, width: `${b[2] * 100}%`, height: `${b[3] / props.artwork.headerBottom * 100}%` })
const logoInk = computed(() => {
  const rgb = props.artwork.colors.logo.slice(1).match(/../g)?.map(v => parseInt(v, 16)) || [255,255,255]
  return rgb[0]! * .21 + rgb[1]! * .72 + rgb[2]! * .07 > 140 ? '#333333' : '#ffffff'
})
</script>
<template>
  <div class="reference-artwork-preview" :style="{ aspectRatio: artwork.width / (artwork.height * artwork.headerBottom) }" role="img" :aria-label="title">
    <img :src="artwork.src" alt="" loading="lazy" />
    <span class="reference-cover" :style="{ ...box(artwork.logoMask), background: artwork.colors.logo }" />
    <span class="reference-cover" :style="{ ...box(artwork.socialMask), background: artwork.colors.social }" />
    <span v-for="(mask, index) in artwork.additionalMasks || []" :key="index" class="reference-cover" :style="{ ...box(mask.box), background: mask.color }" />
    <span class="reference-placeholder" :style="{ ...box(artwork.logoBox), color: logoInk }">Sua logo</span>
    <span class="reference-placeholder reference-instagram" :style="{ ...box(artwork.instagramBox), color: artwork.colors.logoText }">@seuinstagram</span>
  </div>
</template>
<style scoped>
.reference-artwork-preview{position:relative;overflow:hidden;width:100%;max-height:100%;container-type:inline-size}
.reference-artwork-preview>img{position:absolute;top:0;left:0;width:100%;height:auto;max-width:none}
.reference-cover,.reference-placeholder{position:absolute;display:flex;align-items:center;justify-content:center;overflow:hidden}
.reference-placeholder{font-weight:800;font-size:5cqw;line-height:1;white-space:nowrap}
.reference-instagram{font-size:2.5cqw}
</style>
