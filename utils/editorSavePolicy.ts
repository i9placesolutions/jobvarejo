export type SaveSource = 'user' | 'system'

export type SaveStatePolicyInput = {
  forceEmptyOverwrite?: boolean
  allowEmptyOverwrite?: boolean
  source?: SaveSource
}

export const getAdaptiveCoalesceDelayMs = (reason: string, objectCount: number): number => {
  if (!String(reason || '').startsWith('object:')) return 0
  if (objectCount >= 1200) return 420
  if (objectCount >= 700) return 300
  if (objectCount >= 300) return 180
  return 0
}

export const shouldSkipLifecycleSave = (
  saveReason: string,
  lastTransformMutationAt: number,
  now = Date.now()
): boolean => {
  return saveReason.startsWith('lifecycle:') && (now - lastTransformMutationAt) < 350
}

export const shouldRunHeavySanitizeForReason = (saveReason: string): boolean => {
  return saveReason.includes('post-load')
    || saveReason.startsWith('lifecycle:')
    || saveReason.includes('frame-fix')
    || saveReason.includes('history')
    || saveReason.includes('load')
}

export const canAllowEmptyOverwrite = (opts: SaveStatePolicyInput): boolean => {
  const source = (opts.source || 'user') as SaveSource
  return !!opts.forceEmptyOverwrite || (!!opts.allowEmptyOverwrite && source !== 'system')
}

export const shouldSkipAutoSave = (source: SaveSource, reason: string): boolean => {
  return source === 'system'
    || reason === 'initial-history-capture'
    || reason === 'post-load-cleanup'
    || reason.startsWith('lifecycle:')
}

export const shouldSkipThumbnailForReason = (source: SaveSource, reason: string): boolean => {
  return source === 'system'
    || reason === 'initial-history-capture'
    || reason === 'post-load-cleanup'
    || reason.startsWith('lifecycle:')
}

export const getThumbnailMinIntervalMs = (reason: string): number => {
  const isModifiedReason = reason === 'object:modified' || reason === 'object:modified(zone)'
  return isModifiedReason ? 3000 : 600
}

export const canGenerateThumbnailNow = (opts: {
  source: SaveSource
  reason: string
  lastThumbnailAt: number
  now?: number
}): boolean => {
  if (shouldSkipThumbnailForReason(opts.source, opts.reason)) return false
  const now = Number.isFinite(opts.now as number) ? Number(opts.now) : Date.now()
  const minInterval = getThumbnailMinIntervalMs(opts.reason)
  return (now - opts.lastThumbnailAt) >= minInterval
}

export const shouldSkipByFingerprint = (opts: {
  skipIfUnchanged?: boolean
  lastSavedFingerprint?: string | null
  currentFingerprint: string
}): boolean => {
  return !!(opts.skipIfUnchanged ?? true) && String(opts.lastSavedFingerprint || '') === opts.currentFingerprint
}

export const isDuplicateHistoryEntry = (lastEntry: string | undefined, currentEntry: string): boolean => {
  return lastEntry === currentEntry
}
