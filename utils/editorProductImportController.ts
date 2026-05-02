type ImportMode = 'replace' | 'append'

type ValueRef<T> = { value: T }

export type EditorProductImportContext = {
    canvas: ValueRef<any>
    showPasteListModal: ValueRef<boolean>
    pasteListText: ValueRef<string>
    activePasteTab: ValueRef<string>
    pastedImage: ValueRef<string | null>
    isParsingProducts: ValueRef<boolean>
    isProcessing: ValueRef<boolean>
    reviewProducts: ValueRef<any[]>
    targetGridZone: ValueRef<any>
    targetGridZones: ValueRef<any[]>
    activeProductZoneId: ValueRef<string | null>
    productImportExistingCount: ValueRef<number>
    productReviewInitialImportMode: ValueRef<ImportMode>
    showProductReviewModal: ValueRef<boolean>
    getApiAuthHeaders: () => Promise<Record<string, string>>
    notifyEditorInfo: (message: string) => void
    notifyEditorError: (message: string) => void
    isLikelyProductZone: (obj: any) => boolean
    resolveZoneForProductImport: (target: any) => any | null
    resolveImportTargetZone: () => any | null
    resolveRelatedImportZones: (zone: any) => any[]
    setActiveProductZone: (zone: any) => void
    getImportTargetZones: () => any[]
    getImportZonesExistingCount: (zones: any[]) => number
    openProductReviewForZone: (zone: any, opts?: { mode?: ImportMode }) => boolean
}

export const openReviewModalWithProducts = (
    ctx: EditorProductImportContext,
    productsWithImages: any[]
) => {
    ctx.reviewProducts.value = productsWithImages

    // Paste-list/file flows bypass openProductReviewForZone, so resolve the
    // current zone here to avoid reusing a stale target from a previous import.
    if (ctx.canvas.value) {
        const active = ctx.canvas.value.getActiveObject?.() ?? null
        let resolvedZone: any = active && ctx.isLikelyProductZone(active) ? active : null
        if (!resolvedZone && active) {
            resolvedZone = ctx.resolveZoneForProductImport(active)
        }
        if (!resolvedZone) {
            resolvedZone = ctx.resolveImportTargetZone()
        }

        if (resolvedZone && ctx.isLikelyProductZone(resolvedZone)) {
            ctx.targetGridZone.value = resolvedZone
            ctx.targetGridZones.value = ctx.resolveRelatedImportZones(resolvedZone)
            ctx.setActiveProductZone(resolvedZone)
        } else {
            ctx.targetGridZone.value = null
            ctx.targetGridZones.value = []
            ctx.activeProductZoneId.value = null
        }
    }

    try {
        const zones = ctx.getImportTargetZones()
        ctx.productImportExistingCount.value = zones.length > 0 ? ctx.getImportZonesExistingCount(zones) : 0
    } catch {
        ctx.productImportExistingCount.value = 0
    }
    ctx.showProductReviewModal.value = true
}

export const handleImportProductList = (ctx: EditorProductImportContext) => {
    if (!ctx.canvas.value) return

    const active = ctx.canvas.value.getActiveObject()
    if (active && ctx.isLikelyProductZone(active)) {
        ctx.openProductReviewForZone(active, {
            mode: 'replace'
        })
        return
    }

    const zoneFromActive = active ? ctx.resolveZoneForProductImport(active) : null
    if (zoneFromActive && ctx.isLikelyProductZone(zoneFromActive)) {
        ctx.openProductReviewForZone(zoneFromActive, {
            mode: 'replace'
        })
        return
    }

    ctx.targetGridZone.value = null
    ctx.targetGridZones.value = []
    ctx.productReviewInitialImportMode.value = 'replace'
    ctx.showProductReviewModal.value = true
}

export const handlePasteList = async (ctx: EditorProductImportContext) => {
    ctx.showPasteListModal.value = false

    if (!ctx.pasteListText.value && ctx.activePasteTab.value === 'text') {
        return
    }

    if (ctx.isParsingProducts.value) {
        console.warn('[handlePasteList] isParsingProducts was stuck true, resetting')
        ctx.isParsingProducts.value = false
        ctx.isProcessing.value = false
    }

    ctx.isParsingProducts.value = true
    ctx.isProcessing.value = true

    let data: any[] = []
    try {
        if (ctx.activePasteTab.value === 'text' && ctx.pasteListText.value) {
            const { parseTextProductsWithFallback } = await import('~/utils/productImportAiParser')
            data = await parseTextProductsWithFallback(ctx.pasteListText.value, ctx.getApiAuthHeaders)
        }
    } catch (err: any) {
        const { isProductImportParseTimeout, parseBasicProductList } = await import('~/utils/productImportAiParser')
        if (isProductImportParseTimeout(err)) {
            console.warn('[handlePasteList] AI parse timeout (504), falling back to basic parser')
            ctx.notifyEditorInfo('A IA demorou demais. Usando parser básico. Tente uma lista menor se necessário.')
        } else {
            console.warn('[handlePasteList] AI parse failed, falling back to basic parser:', err?.message)
        }
        data = parseBasicProductList(ctx.pasteListText.value)
    } finally {
        ctx.isParsingProducts.value = false
    }

    ctx.isProcessing.value = false

    if (data.length === 0) {
        ctx.pasteListText.value = ''
        ctx.pastedImage.value = null
        return
    }

    openReviewModalWithProducts(ctx, data)
    ctx.pasteListText.value = ''
    ctx.pastedImage.value = null
}

export const handlePasteFile = async (
    ctx: EditorProductImportContext,
    file: File
) => {
    ctx.showPasteListModal.value = false

    if (ctx.isParsingProducts.value) {
        console.warn('[handlePasteFile] isParsingProducts was stuck true, resetting')
        ctx.isParsingProducts.value = false
        ctx.isProcessing.value = false
    }

    ctx.isParsingProducts.value = true
    ctx.isProcessing.value = true

    let data: any[] = []
    try {
        const { parseProductFileWithAI } = await import('~/utils/productImportAiParser')
        data = await parseProductFileWithAI(file, ctx.getApiAuthHeaders)
    } catch (err: any) {
        const { isProductImportParseTimeout } = await import('~/utils/productImportAiParser')
        if (isProductImportParseTimeout(err)) {
            ctx.notifyEditorInfo('A IA demorou demais ao processar o arquivo. Tente um arquivo menor.')
        } else {
            console.error('[handlePasteFile] File parse failed:', err)
            ctx.notifyEditorError('Erro ao processar o arquivo. Tente novamente.')
        }
        ctx.isParsingProducts.value = false
        ctx.isProcessing.value = false
        return
    } finally {
        ctx.isParsingProducts.value = false
    }

    ctx.isProcessing.value = false

    if (data.length === 0) {
        ctx.notifyEditorInfo('Nenhum produto encontrado no arquivo. Verifique o formato.')
        return
    }

    openReviewModalWithProducts(ctx, data)
    ctx.pasteListText.value = ''
    ctx.pastedImage.value = null
}
