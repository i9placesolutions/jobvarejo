<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import {
  buildAccountFlyerPreviewCacheKey,
  getAccountFlyerLogoPreference,
  getAccountFlyerLogoSource,
  runWithAccountFlyerPreviewConcurrency,
  shouldRenderAccountFlyerPreview,
  shouldStartAccountFlyerPreview
} from '~/utils/accountFlyerTemplatePreview'

const props = defineProps<{
  templateId: string
  revision?: string | null
  galleryPreviewUrl?: string | null
  profile: any
  profileReady: boolean
  eager?: boolean
  personalize?: boolean
  fit?: 'cover' | 'contain'
}>()

const emit = defineEmits<{
  (event: 'loading-change', loading: boolean): void
  (event: 'failed'): void
}>()

const serverPreview = ref<{ url: string; revision: string; requestId: number } | null>(null)
const galleryImageFailed = ref(false)
const host = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const isLoading = ref(false)
const hasFailed = ref(false)
let observer: IntersectionObserver | null = null
let generation = 0
let disposed = false
let retryAttempt = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
const { getApiAuthHeaders } = useApiAuth()

const loadPreview = async (requestGeneration: number): Promise<{ url: string; revision: string } | null> => {
  if (requestGeneration !== generation || disposed) return null
  try {
    const headers = await getApiAuthHeaders()
    if (requestGeneration !== generation || disposed) return null
    const query = props.personalize ? { personalize: '1' } : undefined
    const response = await $fetch<any>(`/api/projects/${encodeURIComponent(props.templateId)}/preview`, {
      method: 'GET',
      headers,
      query,
      timeout: 120_000
    })
    if (requestGeneration !== generation || disposed) return null
    const url = String(response?.url || '').trim()
    const revision = String(response?.revision || '').trim()
    if (!url || !revision) throw new Error('O servidor não retornou uma prévia pronta para este modelo.')
    return { url, revision }
  } catch (error: any) {
    const message = String(error?.data?.statusMessage || error?.message || error || 'erro desconhecido')
    console.warn(`[AccountFlyerTemplatePreview] Falha ao consultar a prévia do modelo ${props.templateId}: ${message}`)
    throw new Error(`Falha ao consultar a prévia: ${message}`)
  }
}
const startPreview = () => {
  const hasGalleryPreview = !!props.galleryPreviewUrl && !galleryImageFailed.value
  if (!shouldStartAccountFlyerPreview({
    profileReady: props.profileReady || hasGalleryPreview || !props.personalize,
    hasTemplateId: !!props.templateId,
    isVisible: isVisible.value,
    rendererInProgress: isLoading.value,
    hasRenderedPreview: !!serverPreview.value
  })) return
  const shouldRender = shouldRenderAccountFlyerPreview({
    hasGalleryPreview,
    personalize: !!props.personalize,
    accountHasLogo: !!getAccountFlyerLogoSource(props.profile)
  })
  if (!shouldRender) {
    emit('loading-change', !galleryImageLoaded.value)
    return
  }
  // The neutral gallery image can display while profile data is pending, but
  // account-specific rendering must use the settled profile result.
  if (props.personalize && !props.profileReady) return
  const requestGeneration = ++generation
  const previewTaskKey = [buildAccountFlyerPreviewCacheKey({
    templateId: props.templateId,
    accountId: String(props.profile?.id || ''),
    logoSource: getAccountFlyerLogoSource(props.profile),
    logoPreference: getAccountFlyerLogoPreference(props.profile),
    revision: String(props.revision || 'latest')
  }), props.personalize ? 'personalized' : 'neutral'].join('|')
  const finish = () => {
    if (requestGeneration !== generation || disposed) return
    if (serverPreview.value) return
    if (retryTimer) {
      isLoading.value = false
      return
    }
    if (galleryImageLoaded.value || hasFailed.value) emit('loading-change', false)
    isLoading.value = false
  }
  const render = () => {
    if (requestGeneration !== generation || disposed || !isVisible.value) return
    void runWithAccountFlyerPreviewConcurrency(
      () => loadPreview(requestGeneration),
      previewTaskKey,
      props.eager ? 1 : 0
    )
      .then((preview) => {
        if (requestGeneration !== generation || disposed) return
        if (!preview?.url) throw new Error('O servidor não retornou uma prévia pronta para este modelo.')
        serverPreview.value = { ...preview, requestId: requestGeneration }
      })
      .catch((error: any) => {
        if (requestGeneration !== generation || disposed) return
        serverPreview.value = null
        if (hasGalleryPreview) {
          console.warn(`[AccountFlyerTemplatePreview] Personalização indisponível para o modelo ${props.templateId}; mantendo a miniatura neutra: ${String(error?.message || error)}`)
          return
        }
        if (retryAttempt < 1 && isVisible.value) {
          retryAttempt += 1
          isLoading.value = false
          console.info(`[AccountFlyerTemplatePreview] Nova tentativa ${retryAttempt}/1 para o modelo ${props.templateId}: ${String(error?.message || error)}`)
          if (retryTimer) clearTimeout(retryTimer)
          retryTimer = setTimeout(() => {
            retryTimer = null
            if (!disposed && requestGeneration === generation) startPreview()
          }, 700)
          return
        }
        hasFailed.value = true
        emit('failed')
      })
      .finally(finish)
  }
  isLoading.value = true
  hasFailed.value = false
  if (!hasGalleryPreview || !galleryImageLoaded.value) emit('loading-change', true)
  render()
}

const galleryImageLoaded = ref(false)

const handleGalleryImageLoad = () => {
  galleryImageLoaded.value = true
  isLoading.value = false
  emit('loading-change', false)
}

const handleGalleryImageError = () => {
  galleryImageFailed.value = true
  galleryImageLoaded.value = false
  if (isLoading.value) return
  if (isVisible.value && (!props.personalize || props.profileReady)) startPreview()
}

const handleRenderedImageError = (renderedRequestId: number) => {
  if (serverPreview.value?.requestId !== renderedRequestId) return
  serverPreview.value = null
  if (!isVisible.value || disposed) return
  if (retryAttempt < 1) {
    retryAttempt += 1
    isLoading.value = false
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      if (!disposed) startPreview()
    }, 200)
    return
  }
  if (props.galleryPreviewUrl && !galleryImageFailed.value) {
    isLoading.value = false
    if (galleryImageLoaded.value) emit('loading-change', false)
    return
  }
  hasFailed.value = true
  emit('failed')
}

const handleRenderedImageLoad = (renderedRequestId: number) => {
  if (serverPreview.value?.requestId !== renderedRequestId) return
  retryAttempt = 0
  isLoading.value = false
  emit('loading-change', false)
}

const observeVisibility = () => {
  if (props.eager || typeof IntersectionObserver === 'undefined') {
    isVisible.value = true
    startPreview()
    return
  }
  if (!host.value) return
  observer?.disconnect()
  observer = new IntersectionObserver((entries) => {
    const visible = entries.some(entry => entry.isIntersecting)
    isVisible.value = visible
    if (visible) {
      startPreview()
      return
    }
    if (!serverPreview.value && isLoading.value) {
      generation += 1
      isLoading.value = false
      emit('loading-change', false)
    }
  }, { rootMargin: '120px' })
  observer.observe(host.value)
}

const getGalleryPreviewIdentity = () => JSON.stringify([
  props.templateId,
  String(props.revision || ''),
  String(props.galleryPreviewUrl || '')
])
const getPersonalizationIdentity = () => JSON.stringify([
  String(!!props.personalize),
  String(props.profile?.id || ''),
  getAccountFlyerLogoSource(props.profile),
  JSON.stringify(getAccountFlyerLogoPreference(props.profile))
])
let galleryPreviewIdentity = getGalleryPreviewIdentity()
let personalizationIdentity = getPersonalizationIdentity()

onMounted(observeVisibility)
watch(() => `${getGalleryPreviewIdentity()}::${getPersonalizationIdentity()}`, () => {
  const nextGalleryPreviewIdentity = getGalleryPreviewIdentity()
  const nextPersonalizationIdentity = getPersonalizationIdentity()
  const galleryChanged = nextGalleryPreviewIdentity !== galleryPreviewIdentity
  const personalizationChanged = nextPersonalizationIdentity !== personalizationIdentity
  if (!galleryChanged && !personalizationChanged) return
  galleryPreviewIdentity = nextGalleryPreviewIdentity
  personalizationIdentity = nextPersonalizationIdentity

  generation += 1
  retryAttempt = 0
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  serverPreview.value = null
  if (galleryChanged) {
    galleryImageFailed.value = false
    galleryImageLoaded.value = false
  }
  hasFailed.value = false
  isLoading.value = false
  emit('loading-change', false)
  if (isVisible.value) startPreview()
})
watch(() => props.profileReady, (ready) => { if (ready) startPreview() })
watch(() => props.eager, (eager) => {
  if (!eager) return
  isVisible.value = true
  startPreview()
})

onUnmounted(() => {
  disposed = true
  generation += 1
  if (retryTimer) clearTimeout(retryTimer)
  observer?.disconnect()
})
</script>

<template>
  <img
    v-if="serverPreview"
    :key="`${props.templateId}:${serverPreview.revision}:${serverPreview.requestId}`"
    :src="serverPreview.url"
    :alt="''"
    aria-hidden="true"
    class="account-flyer-template-preview"
    :class="`account-flyer-template-preview--${props.fit || 'cover'}`"
    @load="handleRenderedImageLoad(serverPreview.requestId)"
    @error="handleRenderedImageError(serverPreview.requestId)"
  />
  <img
    v-else-if="props.galleryPreviewUrl && !galleryImageFailed"
    :key="JSON.stringify([props.templateId, props.revision, props.galleryPreviewUrl])"
    :src="props.galleryPreviewUrl"
    :alt="''"
    aria-hidden="true"
    :loading="props.eager ? 'eager' : 'lazy'"
    @load="handleGalleryImageLoad"
    @error="handleGalleryImageError"
    class="account-flyer-template-preview"
    :class="`account-flyer-template-preview--${props.fit || 'cover'}`"
  />
  <span
    ref="host"
    class="account-flyer-template-preview__host"
    :class="`account-flyer-template-preview__host--${props.fit || 'cover'}`"
    aria-hidden="true"
  />
</template>

<style scoped>
.account-flyer-template-preview__host {
  position: absolute;
  inset: 0;
}
.account-flyer-template-preview__host--contain {
  position: absolute;
  inset: 0;
}
.account-flyer-template-preview {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}
.account-flyer-template-preview--contain {
  position: relative;
  inset: auto;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 65dvh;
  object-fit: contain;
  object-position: center;
}
</style>
