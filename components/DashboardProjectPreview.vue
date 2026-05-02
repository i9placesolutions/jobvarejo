<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getDashboardProjectInitials,
  getDashboardProjectThumbStyle,
  normalizeDashboardImageSource
} from '~/utils/dashboardProjectPreview'

const props = withDefaults(defineProps<{
  project: any
  src?: unknown
  imageClass?: string
  fallbackClass?: string
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
}>(), {
  src: '',
  imageClass: '',
  fallbackClass: 'items-end justify-start',
  loading: 'lazy',
  fetchpriority: 'auto'
})

const failed = ref(false)

const normalizedSrc = computed(() => normalizeDashboardImageSource(props.src))
const hasImage = computed(() => !!normalizedSrc.value && !failed.value)
const initials = computed(() => getDashboardProjectInitials(props.project))
const fallbackStyle = computed(() => getDashboardProjectThumbStyle(props.project))

watch(normalizedSrc, () => {
  failed.value = false
})

const handleLoad = (event: Event) => {
  const img = event.target as HTMLImageElement | null
  if (!img) return

  // The storage proxy intentionally returns a 1x1 transparent PNG for missing
  // image objects. Treat it as missing so the dashboard never shows blank cards.
  if ((img.naturalWidth || 0) < 2 || (img.naturalHeight || 0) < 2) {
    failed.value = true
  }
}
</script>

<template>
  <img
    v-if="hasImage"
    :src="normalizedSrc"
    :alt="project?.name || 'Projeto'"
    :class="['dashboard-project-preview-image', imageClass]"
    draggable="false"
    :loading="loading"
    decoding="async"
    :fetchpriority="fetchpriority"
    @dragstart.prevent
    @load="handleLoad"
    @error="failed = true"
  />
  <div
    v-else
    :class="['dashboard-project-preview-fallback', fallbackClass]"
    :style="fallbackStyle"
    :title="project?.name || 'Projeto sem imagem'"
  >
    <span>{{ initials }}</span>
  </div>
</template>

<style scoped>
.dashboard-project-preview-image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
}

.dashboard-project-preview-fallback {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  color: #fff;
}

.dashboard-project-preview-fallback::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.16;
  pointer-events: none;
  background: radial-gradient(circle at 25% 25%, rgba(255,255,255,0.56) 0%, transparent 44%);
}

.dashboard-project-preview-fallback > span {
  position: relative;
  z-index: 1;
  line-height: 0.9;
  letter-spacing: 0;
  filter: drop-shadow(0 8px 16px rgba(15,23,42,0.22));
}
</style>
