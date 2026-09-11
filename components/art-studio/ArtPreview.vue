<script setup lang="ts">
import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import { artLayerImageSrc } from '~/utils/art-studio/logo'
import { ART_ICONS } from '~/types/art-studio'
const props=defineProps<{ composition: ArtComposition; label?: string }>()
const uid=useId()
import { loadArtFonts } from '~/utils/art-studio/fonts'
onMounted(()=>{void loadArtFonts(props.composition)})
watch(()=>props.composition,()=>{if(import.meta.client)void loadArtFonts(props.composition)})
const paint=(layer:ArtLayer)=>layer.gradient?`url(#${uid}-${layer.id})`:layer.fill
const lines = (layer: ArtLayer) => {
  const max = Math.max(
    4,
    Math.floor(layer.width / ((layer.fontSize || 48) * 0.53))
  )
  return (layer.text || '').split('\n').flatMap((paragraph) => {
    const rows: string[] = []
    let row = ''
    for (const word of paragraph.split(' ')) {
      if (row && (row + ' ' + word).length > max) {
        rows.push(row)
        row = word
      } else row += (row ? ' ' : '') + word
    }
    rows.push(row)
    return rows
  })
}
</script>
<template>
  <svg
    :viewBox="`0 0 ${composition.width} ${composition.height}`"
    role="img"
    :aria-label="label || 'Prévia da arte'"
    class="art-preview"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter v-for="layer in composition.layers.filter(l=>l.blur)" :key="`blur-${layer.id}`" :id="`${uid}-blur-${layer.id}`" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur :stdDeviation="layer.blur" /></filter>
      <template v-for="layer in composition.layers.filter(l=>l.gradient)" :key="layer.id">
        <linearGradient v-if="layer.gradient!.type==='linear'" :id="`${uid}-${layer.id}`" :x1=".5-Math.cos(layer.gradient!.angle*Math.PI/180)/2" :y1=".5-Math.sin(layer.gradient!.angle*Math.PI/180)/2" :x2=".5+Math.cos(layer.gradient!.angle*Math.PI/180)/2" :y2=".5+Math.sin(layer.gradient!.angle*Math.PI/180)/2">
          <stop offset="0" :stop-color="layer.gradient!.from" :stop-opacity="layer.gradient!.startOpacity"/><stop offset="1" :stop-color="layer.gradient!.to" :stop-opacity="layer.gradient!.endOpacity"/>
        </linearGradient>
        <radialGradient v-else :id="`${uid}-${layer.id}`"><stop offset="0" :stop-color="layer.gradient!.from" :stop-opacity="layer.gradient!.startOpacity"/><stop offset="1" :stop-color="layer.gradient!.to" :stop-opacity="layer.gradient!.endOpacity"/></radialGradient>
      </template>
    </defs>
    <rect
      :width="composition.width"
      :height="composition.height"
      :fill="composition.background"
    />
    <g
      v-for="layer in composition.layers.filter((l) => l.visible)"
      :key="layer.id"
      :transform="`translate(${layer.x} ${layer.y}) rotate(${layer.rotation})`"
      :opacity="layer.opacity"
      :filter="layer.blur ? `url(#${uid}-blur-${layer.id})` : undefined"
    >
      <text
        v-if="layer.kind === 'text'"
        :fill="paint(layer)"
        :font-family="`Art ${layer.fontFamily}, ${layer.fontFamily}`"
        :font-size="layer.fontSize"
        :transform="`scale(${layer.fontScaleX || 1} 1)`"
        :font-weight="layer.fontWeight"
        :text-anchor="
          layer.align === 'center'
            ? 'middle'
            : layer.align === 'right'
              ? 'end'
              : 'start'
        "
      >
        <tspan
          v-for="(line, i) in lines(layer)"
          :key="i"
          :x="
            layer.align === 'center'
              ? layer.width / (2 * (layer.fontScaleX || 1))
              : layer.align === 'right'
                ? layer.width / (layer.fontScaleX || 1)
                : 0
          "
          :y="(layer.fontSize || 48) * (0.9 + i * (layer.lineHeight ?? 1.16))"
        >
          {{ line }}
        </tspan>
      </text>
      <svg v-else-if="layer.kind==='shape' && layer.shape==='path'" viewBox="0 0 100 100" preserveAspectRatio="none" :width="layer.width" :height="layer.height"><path :d="layer.pathData" :fill="paint(layer)"/></svg>
      <ellipse
        v-else-if="layer.kind === 'shape' && layer.shape === 'ellipse'"
        :cx="layer.width / (2 * (layer.fontScaleX || 1))"
        :cy="layer.height / 2"
        :rx="layer.width / (2 * (layer.fontScaleX || 1))"
        :ry="layer.height / 2"
        :fill="paint(layer)"
      />
      <rect
        v-else-if="layer.kind === 'shape'"
        :rx="layer.cornerRadius || 0"
        :width="layer.width"
        :height="layer.height"
        :fill="paint(layer)"
      />
      <svg
        v-else-if="layer.kind === 'icon'"
        viewBox="0 0 100 100"
        :width="layer.width"
        :height="layer.height"
        :fill="paint(layer)"
      >
        <path :d="ART_ICONS[layer.icon || 'heart']" />
      </svg>
      <image
        v-else-if="layer.kind === 'image' && layer.src"
        :href="artLayerImageSrc(layer)"
        :width="layer.width"
        :height="layer.height"
        :preserveAspectRatio="
          layer.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'
        "
      />
      <g v-else-if="layer.kind === 'image'" :fill="paint(layer)" opacity="0.4">
        <rect
          :width="layer.width"
          :height="layer.height"
          fill="none"
          :stroke="layer.fill"
          stroke-width="2"
          stroke-dasharray="8 8"
          rx="8"
        />
        <text
          :x="layer.width / (2 * (layer.fontScaleX || 1))"
          :y="layer.height / 2"
          font-family="Arial"
          font-size="22"
          text-anchor="middle"
        >
          {{ layer.binding === 'logo' ? 'SUA LOGO' : 'IMAGEM' }}
        </text>
      </g>
    </g>
  </svg>
</template>
<style scoped>
.art-preview {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
