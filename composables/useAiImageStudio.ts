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
  size: '1080x1080' | '1080x1350' | '1080x1920' | '1920x1080' | '1024x1024' | '1024x1536' | '1536x1024'
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

// FIX #3: store the handler in a ref instead of a module-level singleton.
// Previously, `onCreatedHandler` was a module-level `let` — if two components
// opened the studio simultaneously, the second caller's callback overwrote
// the first, causing silent data loss. Now it's stored in a `useState` ref
// which is SSR-safe and scoped to the Vue app instance.

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

  // Use a ref for the handler so it's tied to this composable's lifecycle,
  // not a global module variable that can be stomped by concurrent callers.
  const handlerRef = useState<((asset: CreatedAsset) => void) | null>('aiImageStudioHandler', () => null)

  const openStudio = (opts: AiImageStudioOpenOptions = {}, onCreated?: (asset: CreatedAsset) => void) => {
    options.value = {
      initial: { mode: 'generate', ...(opts.initial || {}) } as AiImageStudioInitial,
      applyMode: opts.applyMode || 'insert',
      replaceTargetId: opts.replaceTargetId
    }
    handlerRef.value = typeof onCreated === 'function' ? onCreated : null
    open.value = true
  }

  // FIX #16: clear handler on close so a stale callback never fires
  // on the next `handleCreated` from a different context.
  const closeStudio = () => {
    open.value = false
    handlerRef.value = null
  }

  const handleCreated = (asset: CreatedAsset) => {
    refreshTick.value = (refreshTick.value || 0) + 1
    try {
      handlerRef.value?.(asset)
    } finally {
      handlerRef.value = null
    }
  }

  return { open, options, refreshTick, openStudio, closeStudio, handleCreated }
}
