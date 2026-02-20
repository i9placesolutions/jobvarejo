import { aiGenerateCanvasData } from './aiGenerateCanvasData'
import type { ApplyAiToPageInput, ApplyAiToPageResult, AiGeneratePayload } from './aiTypes'
import { useProject } from '~/composables/useProject'
import { useApiAuth } from '~/composables/useApiAuth'

const clampDimension = (value: unknown, fallback: number) => {
  const numeric = Math.round(Number(value))
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.max(64, Math.min(5000, numeric))
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { getApiAuthHeaders } = useApiAuth()
  return getApiAuthHeaders()
}

export const applyAiToPage = async (input: ApplyAiToPageInput): Promise<ApplyAiToPageResult> => {
  const { project, activePage, addPage, updatePageData, saveProjectDB } = useProject()
  const projectId = String(project.id || '').trim()
  if (!projectId) throw new Error('Projeto invalido para aplicar geracao de IA.')
  if (input.projectId && input.projectId !== projectId) {
    throw new Error('Projeto ativo diferente do projectId solicitado.')
  }

  const prompt = String(input.prompt || '').trim()
  const referenceImageDataUrl = String(input.options?.referenceImageDataUrl || '').trim()
  const hasReferenceImage = !!referenceImageDataUrl
  if (!prompt && !hasReferenceImage) {
    throw new Error('Informe o tema/estilo ou envie uma imagem de referencia.')
  }

  const baseWidth = clampDimension(input.options?.size?.width, Number(activePage.value?.width || 1080))
  const baseHeight = clampDimension(input.options?.size?.height, Number(activePage.value?.height || 1920))
  const pageType = input.options?.pageType || activePage.value?.type || 'RETAIL_OFFER'

  let pageIndex = -1
  if (input.mode === 'newPage') {
    addPage(pageType, baseWidth, baseHeight, `Pagina IA ${project.pages.length + 1}`)
    pageIndex = project.activePageIndex
  } else {
    const wantedId = String(input.pageId || activePage.value?.id || '').trim()
    pageIndex = project.pages.findIndex((page) => String(page?.id || '').trim() === wantedId)
    if (pageIndex < 0) pageIndex = project.activePageIndex
    if (pageIndex < 0 || !project.pages[pageIndex]) {
      throw new Error('Pagina alvo nao encontrada para substituir com IA.')
    }
  }

  const page = project.pages[pageIndex]
  if (!page) throw new Error('Pagina alvo indisponivel para aplicar IA.')

  page.width = baseWidth
  page.height = baseHeight
  page.type = pageType
  project.activePageIndex = pageIndex

  const generatePayload: Partial<AiGeneratePayload> = {
    prompt,
    options: {
      pageType,
      size: {
        width: baseWidth,
        height: baseHeight
      },
      referenceImageDataUrl: hasReferenceImage ? referenceImageDataUrl : null,
      cloneStrength: hasReferenceImage
        ? Math.max(0, Math.min(100, Number(input.options?.cloneStrength ?? 100)))
        : undefined
    }
  }

  const headers = await getAuthHeaders()
  const canvasData = await aiGenerateCanvasData(generatePayload, { headers })
  updatePageData(pageIndex, canvasData, { source: 'user', markUnsaved: true })

  const shouldPersist = !project.id.startsWith('proj_')
  if (shouldPersist) {
    // Reutiliza o fluxo oficial de persistência atual:
    // - saveCanvasData(page_{pageId}.json) via useStorage
    // - atualização de projects.canvas_data mantendo o shape existente
    // - backup canvasData no banco
    await saveProjectDB()
  }

  return {
    pageId: page.id,
    pageIndex,
    canvasData,
    persisted: shouldPersist
  }
}
