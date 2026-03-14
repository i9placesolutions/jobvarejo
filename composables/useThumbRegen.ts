import { ref } from 'vue'
import { generateThumbnailFromCanvasJson } from '~/utils/editorThumbnail'
import { useApiAuth } from '~/composables/useApiAuth'
import { useStorage } from '~/composables/useStorage'

export type ThumbRegenStatus = 'idle' | 'running' | 'done' | 'error'

const CONCURRENCY = 5

export const useThumbRegen = () => {
  const status = ref<ThumbRegenStatus>('idle')
  const progress = ref(0)
  const total = ref(0)
  const errors = ref(0)

  const { getApiAuthHeaders } = useApiAuth()
  const { saveThumbnail } = useStorage()

  const processProject = async (projectId: string, StaticCanvas: any): Promise<void> => {
    try {
      const headers = await getApiAuthHeaders()
      const project = await $fetch<any>(`/api/projects?id=${projectId}`, { headers })

      const pages: any[] = Array.isArray(project?.canvas_data) ? project.canvas_data : []
      if (!pages.length) return

      const page = pages[0]
      let canvasJson = page?.canvasData || null

      if (!canvasJson && page?.canvasDataPath) {
        try {
          const pathKey = page.canvasDataPath.startsWith('/')
            ? page.canvasDataPath
            : `/api/storage/p?key=${encodeURIComponent(page.canvasDataPath)}`
          canvasJson = await $fetch(pathKey, { headers })
        } catch { /* ignore */ }
      }

      if (!canvasJson) return

      const dataUrl = await generateThumbnailFromCanvasJson({
        sourceJson: canvasJson,
        staticCanvasCtor: StaticCanvas,
        pageWidth: Number(page?.width || 1080),
        pageHeight: Number(page?.height || 1920),
      })

      if (!dataUrl) return

      const pageId = String(page?.id || pages[0]?.id || 'page_0')
      const url = await saveThumbnail(projectId, pageId, dataUrl)

      if (url) {
        await $fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers,
          body: { preview_url: url }
        }).catch(() =>
          $fetch('/api/projects', {
            method: 'PATCH',
            headers,
            body: { id: projectId, preview_url: url }
          }).catch(() => null)
        )
      }
    } catch {
      errors.value++
    } finally {
      progress.value++
    }
  }

  const regenerateAll = async (projectIds: string[]) => {
    if (status.value === 'running') return
    if (!projectIds.length) return

    status.value = 'running'
    progress.value = 0
    errors.value = 0
    total.value = projectIds.length

    let fabricModule: any = null
    try {
      fabricModule = await import('fabric')
    } catch {
      status.value = 'error'
      return
    }

    const StaticCanvas = fabricModule?.StaticCanvas || fabricModule?.fabric?.StaticCanvas
    if (!StaticCanvas) {
      status.value = 'error'
      return
    }

    // Process in batches of CONCURRENCY
    for (let i = 0; i < projectIds.length; i += CONCURRENCY) {
      const batch = projectIds.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(id => processProject(id, StaticCanvas)))
    }

    status.value = 'done'
  }

  return { status, progress, total, errors, regenerateAll }
}
