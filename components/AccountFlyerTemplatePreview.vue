<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { generateThumbnailFromCanvasJson } from '~/utils/editorThumbnail'
import {
  buildFlyerTemplateConfigFromPages,
  inferFormatIdFromPage,
  orderFlyerTemplatePages
} from '~/utils/flyerTemplateApi'
import {
  bindAccountLogoToFlyerCanvas,
  buildAccountFlyerPreviewCacheKey,
  cacheAccountFlyerPreview,
  getCachedAccountFlyerPreview,
  getAccountFlyerTemplateCanvasData,
  getAccountFlyerTemplateCanvasDataPath,
  getAccountFlyerTemplatePages,
  getAccountFlyerLogoPreference,
  getAccountFlyerLogoSource,
  normalizeAccountFlyerCanvasImageSources,
  runWithAccountFlyerPreviewConcurrency
} from '~/utils/accountFlyerTemplatePreview'
import { autoTrimFabricImageAsync } from '~/utils/fabricImageHelpers'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

const props = defineProps<{
  templateId: string
  revision?: string | null
  profile: any
  profileReady: boolean
  eager?: boolean
  fit?: 'cover' | 'contain'
}>()

const emit = defineEmits<{
  (event: 'loading-change', loading: boolean): void
  (event: 'failed'): void
}>()

const imageUrl = ref('')
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
const { loadCanvasDataFromPath } = useStorage()

const loadPreview = async (requestGeneration: number): Promise<string> => {
  if (requestGeneration !== generation || disposed) return ''
  let stage = 'autenticando e consultando o modelo'
  try {
  const rawLogoSource = getAccountFlyerLogoSource(props.profile)
  const logoPreference = getAccountFlyerLogoPreference(props.profile)
  const cacheIdentity = {
    templateId: props.templateId,
    accountId: String(props.profile?.id || ''),
    logoSource: rawLogoSource,
    logoPreference
  }
  if (props.revision) {
    const cached = await getCachedAccountFlyerPreview(buildAccountFlyerPreviewCacheKey({
      ...cacheIdentity,
      revision: String(props.revision)
    }))
    if (cached) return cached
  }
  if (requestGeneration !== generation || disposed) return ''
  const headers = await getApiAuthHeaders()
  const project = await $fetch<any>('/api/projects', {
    headers,
    query: { id: props.templateId, library: '1' }
  })
  if (requestGeneration !== generation || disposed) return ''

  stage = 'lendo metadados das páginas'
  const pages = getAccountFlyerTemplatePages(project)
  if (!pages.length) throw new Error('Modelo sem páginas.')
  const config = buildFlyerTemplateConfigFromPages(project?.template_config, pages, props.templateId)
  const orderedPages = orderFlyerTemplatePages(pages, config)
  const page = orderedPages.find((candidate: any) => (
    String(candidate?.templateModelId || '').trim() === String(config.defaultModelId || '').trim() &&
    inferFormatIdFromPage(candidate) === config.defaultFormatId
  )) || orderedPages[0]
  if (!page) throw new Error('Modelo sem página padrão.')

  const revision = String(props.revision || project?.updated_at || project?.updatedAt || '').trim()
  const cacheKey = revision
    ? buildAccountFlyerPreviewCacheKey({ ...cacheIdentity, revision })
    : ''
  if (cacheKey) {
    const cached = await getCachedAccountFlyerPreview(cacheKey)
    if (cached) return cached
  }

  stage = 'carregando o canvas da página padrão'
  let canvasJson = getAccountFlyerTemplateCanvasData(page)
  const canvasDataPath = getAccountFlyerTemplateCanvasDataPath(page)
  if (!canvasJson && canvasDataPath) {
    canvasJson = await loadCanvasDataFromPath(canvasDataPath)
  }
  if (!canvasJson || typeof canvasJson !== 'object') throw new Error('Canvas do modelo indisponível.')

  stage = 'carregando a logo da conta e preparando o canvas'
  let logoSource = rawLogoSource ? (toWasabiProxyUrl(rawLogoSource) || rawLogoSource) : ''
  const { StaticCanvas, FabricImage } = await import('fabric')
  let logoSize: { width: number; height: number; cropX: number; cropY: number } | null = null
  if (logoSource) {
    try {
      const logo = await FabricImage.fromURL(logoSource, { crossOrigin: 'anonymous' })
      await autoTrimFabricImageAsync(logo, { preserveVisualPosition: false })
      logoSize = {
        width: Number(logo.width || 0),
        height: Number(logo.height || 0),
        cropX: Number(logo.cropX || 0),
        cropY: Number(logo.cropY || 0)
      }
      if (!(logoSize.width > 0 && logoSize.height > 0)) throw new Error('A logo não possui dimensões válidas.')
    } catch {
      // A galeria continua sem logo da conta; nunca volta à miniatura persistida do modelo.
      logoSource = ''
      logoSize = null
    }
  }
  if (requestGeneration !== generation || disposed) return ''

  const safeCanvasJson = bindAccountLogoToFlyerCanvas(normalizeAccountFlyerCanvasImageSources(canvasJson), {
    logoSrc: logoSource,
    logoSize,
    logoPreference
  })
  stage = 'renderizando a prévia do canvas'
  const thumbnail = await generateThumbnailFromCanvasJson({
    sourceJson: safeCanvasJson,
    staticCanvasCtor: StaticCanvas,
    pageWidth: Number(page.width || 1080),
    pageHeight: Number(page.height || 1350)
  })
  if (!thumbnail) throw new Error('O renderizador não gerou uma imagem para o canvas.')
  if (cacheKey) void cacheAccountFlyerPreview(cacheKey, thumbnail)
  return thumbnail
  } catch (error: any) {
    const message = String(error?.message || error || 'erro desconhecido')
    console.warn(`[AccountFlyerTemplatePreview] Falha ao ${stage} (modelo ${props.templateId}): ${message}`)
    throw new Error(`Falha ao ${stage}: ${message}`)
  }
}

const startPreview = () => {
  if (!props.profileReady || !props.templateId || !isVisible.value || isLoading.value || imageUrl.value) return
  const requestGeneration = ++generation
  const previewTaskKey = buildAccountFlyerPreviewCacheKey({
    templateId: props.templateId,
    accountId: String(props.profile?.id || ''),
    logoSource: getAccountFlyerLogoSource(props.profile),
    logoPreference: getAccountFlyerLogoPreference(props.profile),
    revision: String(props.revision || 'latest')
  })
  const finish = () => {
    if (requestGeneration !== generation || disposed) return
    isLoading.value = false
    emit('loading-change', false)
  }
  const render = () => {
    if (requestGeneration !== generation || disposed || !isVisible.value) return
    void runWithAccountFlyerPreviewConcurrency(
      () => loadPreview(requestGeneration),
      previewTaskKey,
      props.eager ? 1 : 0
    )
      .then((url) => {
        if (requestGeneration !== generation || disposed) return
        if (!url) throw new Error('Não foi possível gerar a prévia do modelo.')
        imageUrl.value = url
        retryAttempt = 0
      })
      .catch((error: any) => {
        if (requestGeneration !== generation || disposed) return
        imageUrl.value = ''
        if (retryAttempt < 1 && isVisible.value) {
          retryAttempt += 1
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
  emit('loading-change', true)
  if (props.revision) {
    void getCachedAccountFlyerPreview(previewTaskKey).then((cached) => {
      if (requestGeneration !== generation || disposed) return
      if (cached) {
        imageUrl.value = cached
        retryAttempt = 0
        finish()
      } else render()
    }).catch(render)
  } else render()
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
    if (!imageUrl.value && isLoading.value) {
      generation += 1
      isLoading.value = false
      emit('loading-change', false)
    }
  }, { rootMargin: '120px' })
  observer.observe(host.value)
}

onMounted(observeVisibility)
watch(() => props.profileReady, (ready) => { if (ready) startPreview() })
watch(() => [
  props.templateId,
  String(props.revision || ''),
  String(props.profile?.id || ''),
  getAccountFlyerLogoSource(props.profile),
  JSON.stringify(getAccountFlyerLogoPreference(props.profile))
].join('|'), () => {
  generation += 1
  retryAttempt = 0
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  imageUrl.value = ''
  hasFailed.value = false
  isLoading.value = false
  emit('loading-change', false)
  if (isVisible.value) startPreview()
})
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
    v-if="imageUrl"
    :src="imageUrl"
    :alt="''"
    aria-hidden="true"
    class="account-flyer-template-preview"
    :class="`account-flyer-template-preview--${props.fit || 'cover'}`"
  />
  <span
    v-else
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
  position: relative;
  inset: auto;
  display: block;
  width: 1px;
  height: 1px;
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
