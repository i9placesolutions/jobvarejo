export type AiPageType = 'RETAIL_OFFER' | 'FREE_DESIGN'
export type AiApplyMode = 'replace' | 'newPage'

export type AiCanvasSize = {
  width: number
  height: number
}

export type AiGenerateOptions = {
  pageType: AiPageType
  size: AiCanvasSize
  referenceImageDataUrl?: string | null
  cloneStrength?: number
}

export type AiGeneratePayload = {
  prompt: string
  options: AiGenerateOptions
}

export type AiFabricObject = Record<string, any>

export type AiCanvasData = {
  version: '7.1.0'
  objects: AiFabricObject[]
  [key: string]: any
}

export type AiGenerateResult = {
  canvasData: AiCanvasData
}

export type ApplyAiToPageInput = {
  projectId: string
  pageId?: string | null
  mode: AiApplyMode
  prompt?: string
  options?: Partial<AiGenerateOptions>
}

export type ApplyAiToPageResult = {
  pageId: string
  pageIndex: number
  canvasData: AiCanvasData
  persisted: boolean
}
