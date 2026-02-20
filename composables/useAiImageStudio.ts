import type { Ref } from 'vue'

export type AiImageStudioMode = 'generate' | 'similar' | 'edit'

export type AiImageStudioInitial = Partial<{
  mode: AiImageStudioMode
  prompt: string
  negativePrompt: string
  extraInstructions: string
  filenameBase: string
  siteUrl: string
  transparent: boolean
  removeBg: boolean
  size: '1024x1024' | '1024x1536' | '1536x1024'
  modelImageUrl: string
  baseImageUrl: string
  refUrls: string[]
}>

export type AiImageStudioOpenOptions = {
  initial?: AiImageStudioInitial
  applyMode?: 'insert' | 'replace'
  replaceTargetId?: string
}

type CreatedAsset = { id: string; name: string; url: string }

let onCreatedHandler: ((asset: CreatedAsset) => void) | null = null

export const useAiImageStudio = (): {
  open: Ref<boolean>
  options: Ref<AiImageStudioOpenOptions>
  refreshTick: Ref<number>
  openStudio: (opts?: AiImageStudioOpenOptions, onCreated?: (asset: CreatedAsset) => void) => void
  closeStudio: () => void
  handleCreated: (asset: CreatedAsset) => void
} => {
  const open = useState<boolean>('aiImageStudioOpen', () => false)
  const options = useState<AiImageStudioOpenOptions>('aiImageStudioOptions', () => ({ initial: { mode: 'generate' }, applyMode: 'insert' }))
  const refreshTick = useState<number>('aiImageStudioRefreshTick', () => 0)

  const openStudio = (opts: AiImageStudioOpenOptions = {}, onCreated?: (asset: CreatedAsset) => void) => {
    options.value = {
      initial: { mode: 'generate', ...(opts.initial || {}) } as any,
      applyMode: opts.applyMode || 'insert',
      replaceTargetId: opts.replaceTargetId
    }
    onCreatedHandler = typeof onCreated === 'function' ? onCreated : null
    open.value = true
  }

  const closeStudio = () => {
    open.value = false
  }

  const handleCreated = (asset: CreatedAsset) => {
    refreshTick.value = (refreshTick.value || 0) + 1
    try {
      onCreatedHandler?.(asset)
    } finally {
      onCreatedHandler = null
    }
  }

  return { open, options, refreshTick, openStudio, closeStudio, handleCreated }
}

