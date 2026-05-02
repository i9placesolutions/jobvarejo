import { buildCardRecoverySearchPayload } from '~/utils/cardRecoveryPayload'
import { isAuthLookupError } from '~/utils/canvasValidation'
import { isLikelyPlaceholderImageSrc } from '~/utils/canvasJsonClassifiers'
import { getImageSourceFromObject } from '~/utils/fabricImageHelpers'
import {
    compareMissingProductImageRecoveryCandidates,
    computeMissingProductImageRecoveryViewportRect,
    getMissingProductImageRecoveryBatchLimit,
    measureMissingProductImageRecoveryPriority,
    type MissingProductImageRecoveryCandidate
} from '~/utils/missingProductImageRecovery'
import { toWasabiProxyUrl } from '~/utils/storageProxy'
import {
    extractContaboBucketAndKey,
    normalizeRecoveryImageUrl as normalizeRecoveryImageUrlHelper
} from '~/utils/storageUrlHelpers'

type RecoveryLookupResult = { status: 'ok' | 'empty' | 'error' | 'auth'; url: string | null }

export type EditorMissingProductImageRecoveryContext = {
    canvas: any
    isCanvasDestroyed: { value: boolean }
    getActiveProjectPageId: () => string
    getApiAuthHeaders: () => Promise<Record<string, string>>
    collectObjectsDeep: (root: any) => any[]
    isLikelyProductCard: (obj: any) => boolean
    isProductCardContainer: (obj: any) => boolean
    getPreferredProductImageFromGroup: (group: any) => any
    resolveSelectedProductCardContext: (active: any) => { card: any | null; image: any | null }
    findProductCardParentGroup: (target: any) => any | null
    replaceImageByCustomId: (targetId: string, newUrl: string, opts?: { save?: boolean; setActive?: boolean }) => Promise<boolean>
    addImageToProductCardByUrl: (card: any, newUrl: string, opts?: { save?: boolean; setActive?: boolean }) => Promise<boolean>
    refreshCanvasObjects: () => void
    safeRequestRenderAll: () => void
    saveCurrentState: (opts?: any) => void | Promise<void>
    makeCanvasObjectId: () => string
}

let isRecoveringMissingProductImages = false

const normalizeRecoveryImageUrl = (src: string): string =>
    normalizeRecoveryImageUrlHelper(src, toWasabiProxyUrl, extractContaboBucketAndKey)

const fetchRecoveryImageUrlForCard = async (
    card: any,
    ctx: EditorMissingProductImageRecoveryContext,
    options: { matchMode?: 'precise' | 'loose' } = {}
): Promise<RecoveryLookupResult> => {
    const payload = buildCardRecoverySearchPayload(card)
    if (!payload?.term) return { status: 'empty', url: null }
    const matchMode = options.matchMode === 'loose' ? 'loose' : 'precise'

    try {
        const headers = await ctx.getApiAuthHeaders()
        const result = await $fetch<{ url?: string }>('/api/process-product-image', {
            method: 'POST',
            headers,
            body: {
                ...payload,
                bgPolicy: 'always',
                matchMode,
                strictMode: matchMode === 'precise'
            }
        })
        const url = String(result?.url || '').trim()
        if (url) return { status: 'ok', url }
        return { status: 'empty', url: null }
    } catch (err) {
        if (isAuthLookupError(err)) {
            return { status: 'auth', url: null }
        }
        console.warn('[recover-missing-product-images] Falha ao buscar imagem por termo:', err)
        return { status: 'error', url: null }
    }
}

const fetchRecoveryImageUrlFromAssets = async (
    term: string,
    ctx: EditorMissingProductImageRecoveryContext
): Promise<RecoveryLookupResult> => {
    const query = String(term || '').trim()
    if (!query) return { status: 'empty', url: null }
    try {
        const headers = await ctx.getApiAuthHeaders()
        const result = await $fetch<any>('/api/assets', {
            headers,
            query: {
                q: query,
                limit: 1
            }
        })
        if (Array.isArray(result) && result[0]?.url) {
            return { status: 'ok', url: String(result[0].url || '').trim() || null }
        }
        if (result && Array.isArray(result.items) && result.items[0]?.url) {
            return { status: 'ok', url: String(result.items[0].url || '').trim() || null }
        }
        return { status: 'empty', url: null }
    } catch (err) {
        console.warn('[recover-missing-product-images] Falha no fallback /api/assets:', err)
        return { status: 'error', url: null }
    }
}

const getMissingProductImageRecoveryViewportRect = (
    ctx: EditorMissingProductImageRecoveryContext
) => {
    const c = ctx.canvas
    if (!c) return null
    return computeMissingProductImageRecoveryViewportRect(
        c.viewportTransform,
        c.getWidth?.() || 0,
        c.getHeight?.() || 0,
        c.getZoom?.() || 1
    )
}

const getMissingProductImageRecoveryActiveCard = (
    ctx: EditorMissingProductImageRecoveryContext
): any | null => {
    const active = ctx.canvas?.getActiveObject?.()
    if (!active) return null
    const selected = ctx.resolveSelectedProductCardContext(active)
    if (selected?.card) return selected.card
    if (ctx.isLikelyProductCard(active) || ctx.isProductCardContainer(active)) return active
    return ctx.findProductCardParentGroup(active)
}

export const recoverMissingProductCardImages = async (
    ctx: EditorMissingProductImageRecoveryContext,
    opts: { expectedPageId?: string | null } = {}
): Promise<{ recoveredCount: number; pendingCount: number }> => {
    const expectedPageId = String(opts.expectedPageId || ctx.getActiveProjectPageId()).trim()
    const isExpectedPageStillActive = () => !expectedPageId || ctx.getActiveProjectPageId() === expectedPageId
    if (!ctx.canvas || ctx.isCanvasDestroyed.value || isRecoveringMissingProductImages || !isExpectedPageStillActive()) {
        return { recoveredCount: 0, pendingCount: 0 }
    }
    isRecoveringMissingProductImages = true
    try {
        if (!isExpectedPageStillActive()) {
            return { recoveredCount: 0, pendingCount: 0 }
        }
        const viewportRect = getMissingProductImageRecoveryViewportRect(ctx)
        const activeCard = getMissingProductImageRecoveryActiveCard(ctx)
        const cards = ctx.collectObjectsDeep(ctx.canvas)
            .filter((obj: any) => !!(obj?.type === 'group' && (obj?.isSmartObject || obj?.isProductCard || ctx.isLikelyProductCard(obj))))

        const candidates: MissingProductImageRecoveryCandidate[] = []
        for (const card of cards) {
            if (!isExpectedPageStillActive() || ctx.isCanvasDestroyed.value) break
            const imageObj = ctx.getPreferredProductImageFromGroup(card)
            const hasImageObject = !!imageObj

            let needsRecovery = !hasImageObject
            if (imageObj) {
                const currentSrc = getImageSourceFromObject(imageObj)
                const hasBrokenSource = isLikelyPlaceholderImageSrc(currentSrc)
                const hasInvalidGeometry = !Number.isFinite(Number(imageObj.width)) || Number(imageObj.width) <= 0 || !Number.isFinite(Number(imageObj.height)) || Number(imageObj.height) <= 0
                const imageEl: any = (imageObj as any)?._originalElement || (imageObj as any)?._element || null
                const naturalW = Number(imageEl?.naturalWidth ?? imageEl?.width ?? 0)
                const naturalH = Number(imageEl?.naturalHeight ?? imageEl?.height ?? 0)
                const hasLikelyBrokenElement = Number.isFinite(naturalW) && Number.isFinite(naturalH) && naturalW <= 1 && naturalH <= 1
                needsRecovery = hasBrokenSource || hasInvalidGeometry || hasLikelyBrokenElement
            }
            if (!needsRecovery) continue

            const triedMap = (((card as any).__missingImageRecoveryTried && typeof (card as any).__missingImageRecoveryTried === 'object')
                ? (card as any).__missingImageRecoveryTried
                : {}) as Record<string, true>
            ;(card as any).__missingImageRecoveryTried = triedMap

            const rawCandidates = [
                String((card as any)?.imageUrl || '').trim(),
                String((card as any)?._productData?.imageUrl || '').trim(),
                String((card as any)?._productData?.image || '').trim(),
                String((imageObj as any)?.__originalSrc || '').trim(),
                String((imageObj as any)?.src || '').trim(),
                String((imageObj as any)?._element?.src || '').trim(),
                String((imageObj as any)?._originalElement?.src || '').trim(),
                String((imageObj as any)?._fallbackSrc || '').trim()
            ].filter(Boolean)
            const normalizedCandidates = Array.from(new Set(rawCandidates))
                .map((src) => normalizeRecoveryImageUrl(src))
                .filter((src) => !!src && !isLikelyPlaceholderImageSrc(src))

            candidates.push({
                card,
                imageObj,
                hasImageObject,
                triedMap,
                normalizedCandidates,
                needsRemoteLookup: !(card as any).__missingImageRemoteLookupDone,
                priority: measureMissingProductImageRecoveryPriority(card, viewportRect, activeCard)
            })
        }

        if (!candidates.length) {
            return { recoveredCount: 0, pendingCount: 0 }
        }

        candidates.sort(compareMissingProductImageRecoveryCandidates)
        const batchLimit = getMissingProductImageRecoveryBatchLimit(candidates)
        const candidatesToProcess = candidates.slice(0, batchLimit)

        if (import.meta.dev && candidates.length > candidatesToProcess.length) {
            console.log('[recover-missing-product-images] Processing prioritized batch:', {
                totalCandidates: candidates.length,
                batchLimit,
                visibleFirst: candidatesToProcess.filter((candidate) => candidate.priority.selected || candidate.priority.inView).length
            })
        }

        let recoveredCount = 0
        let pendingCount = candidates.length
        let remoteLookupsLeft = 30
        for (const candidate of candidatesToProcess) {
            if (!isExpectedPageStillActive() || ctx.isCanvasDestroyed.value) break
            const { card, imageObj, hasImageObject, triedMap, normalizedCandidates, needsRemoteLookup } = candidate

            const tryApplyImageUrl = async (url: string): Promise<boolean> => {
                if (!url) return false
                if (triedMap[url]) return false
                triedMap[url] = true

                if (hasImageObject) {
                    if (!(imageObj as any)._customId) {
                        ;(imageObj as any)._customId = ctx.makeCanvasObjectId()
                    }
                    return await ctx.replaceImageByCustomId(String((imageObj as any)._customId), url, {
                        save: false,
                        setActive: false
                    })
                }
                return await ctx.addImageToProductCardByUrl(card, url, {
                    save: false,
                    setActive: false
                })
            }

            let restored = false
            for (const candidateUrl of normalizedCandidates) {
                restored = await tryApplyImageUrl(candidateUrl)
                if (restored) break
            }

            if (!restored && remoteLookupsLeft > 0 && needsRemoteLookup) {
                remoteLookupsLeft -= 1
                const fetchedResult = await fetchRecoveryImageUrlForCard(card, ctx, { matchMode: 'precise' })
                if (fetchedResult.url) {
                    const normalizedFetched = normalizeRecoveryImageUrl(fetchedResult.url)
                    restored = await tryApplyImageUrl(normalizedFetched)
                }
                const payload = buildCardRecoverySearchPayload(card)
                const assetsResult = !restored
                    ? await fetchRecoveryImageUrlFromAssets(String(payload?.term || ''), ctx)
                    : { status: 'empty', url: null as string | null }
                if (!restored && assetsResult.url) {
                    const normalizedAssetsUrl = normalizeRecoveryImageUrl(assetsResult.url)
                    restored = await tryApplyImageUrl(normalizedAssetsUrl)
                }

                const retryableError =
                    fetchedResult.status === 'auth' ||
                    fetchedResult.status === 'error' ||
                    assetsResult.status === 'error'
                if (!retryableError) {
                    ;(card as any).__missingImageRemoteLookupDone = true
                } else {
                    delete (card as any).__missingImageRemoteLookupDone
                }
            }

            if (restored) {
                recoveredCount += 1
                pendingCount = Math.max(0, pendingCount - 1)
            }
        }

        if (recoveredCount > 0 && ctx.canvas && isExpectedPageStillActive()) {
            ctx.refreshCanvasObjects()
            ctx.safeRequestRenderAll()
            await ctx.saveCurrentState({
                reason: 'recover-missing-product-images',
                source: 'system',
                skipIfUnchanged: true
            })
        }
        return { recoveredCount, pendingCount }
    } finally {
        isRecoveringMissingProductImages = false
    }
}
