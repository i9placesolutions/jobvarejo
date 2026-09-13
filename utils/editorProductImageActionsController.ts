import { autoTrimFabricImage, trimImageFile } from './fabricImageHelpers'

type ProductImageMode = 'replace' | 'add'

type ProductImageAsset = { id?: string; name?: string; url: string; key?: string }

export type EditorProductImageActionsContext = {
    productImagePickerLoading?: { value: boolean }
    productImagePickerError?: { value: string }
    productImageReplaceScope?: { value: 'single' | 'all' }
    canvas: { value: any }
    fabric: any
    fileInput: { value: HTMLInputElement | null }
    aiStudio: any
    productImagePickerMode: { value: ProductImageMode }
    productImagePickerSearch: { value: string }
    productImagePickerTargetImageId: { value: string | null }
    productImagePickerTargetCardId: { value: string | null }
    pendingImageReplaceTargetId: { value: string | null }
    pendingImageAddCardId: { value: string | null }
    pendingLocalImageActionMode: { value: ProductImageMode | null }
    showProductImageUploadPicker: { value: boolean }
    prepareProductImageUrl?: (url: string, sourceKey?: string) => Promise<string>
    refreshAiStudioUploads: () => Promise<void>
    refreshProductImagePickerAssets?: () => Promise<void>
    replaceImageByCustomId: (targetId: string, newUrl: string, opts?: { save?: boolean; setActive?: boolean; scope?: 'single' | 'all' }) => Promise<boolean>
    insertAssetToCanvas: (asset: ProductImageAsset, opts?: { pos?: { x: number; y: number } }) => Promise<void>
    findProductCardByCustomId: (id: string) => any | null
    addImageToProductCardByUrl: (card: any, newUrl: string, opts?: { save?: boolean; setActive?: boolean }) => Promise<boolean>
    uploadFile: (file: File, options?: { removeBackground?: boolean }) => Promise<{ success?: boolean; url?: string }>
    getCenterOfView: () => { x: number; y: number }
    makeCanvasObjectId: () => string
    makeId: () => string
    toWasabiProxyUrl: (url: string) => string | null
    isLikelyProductCard: (obj: any) => boolean
    groupLocalToCanvasPoint: (group: any, x: number, y: number) => { x: number; y: number }
    safeAddWithUpdate: (group: any, obj?: any) => void
    safeRequestRenderAll: () => void
    refreshCanvasObjects: () => void
    saveCurrentState: (...args: any[]) => void
    notifyEditorError: (message: string) => void
}

const shouldRetryImagePreparation = (error: any): boolean => {
    const status = Number(
        error?.statusCode
        || error?.status
        || error?.response?.status
        || error?.data?.statusCode
        || 0
    )
    if (Number.isFinite(status) && status > 0) {
        return status === 408 || status === 429 || status >= 500
    }

    const code = String(error?.code || error?.name || '').toLowerCase()
    const message = String(error?.message || error?.statusMessage || '').toLowerCase()
    return !status
        || /econnreset|econnrefused|etimedout|eai_again|timeout|network|abort/.test(code)
        || /socket hang up|connection (?:reset|terminated)|timeout|network/i.test(message)
}

const preparePickerImage = async (
    ctx: EditorProductImageActionsContext,
    asset: ProductImageAsset
): Promise<string> => {
    if (!ctx.prepareProductImageUrl) return asset.url

    let lastError: any = null
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return asset.key
                ? await ctx.prepareProductImageUrl(asset.url, asset.key)
                : await ctx.prepareProductImageUrl(asset.url)
        } catch (error: any) {
            lastError = error
            if (attempt >= 2 || !shouldRetryImagePreparation(error)) break
        }
    }

    throw lastError || new Error('Não foi possível preparar a imagem selecionada.')
}

export const clearPendingProductImageOperation = (ctx: EditorProductImageActionsContext) => {
    ctx.pendingLocalImageActionMode.value = null
    ctx.pendingImageReplaceTargetId.value = null
    ctx.pendingImageAddCardId.value = null
    ctx.productImagePickerTargetImageId.value = null
    ctx.productImagePickerTargetCardId.value = null
}

export const handleAiStudioCreated = async (
    ctx: EditorProductImageActionsContext,
    asset: { id: string; name: string; url: string }
) => {
    if (!asset?.url) return
    await ctx.refreshAiStudioUploads()

    const opts = ctx.aiStudio.options.value || {}
    if (opts.applyMode === 'replace' && opts.replaceTargetId) {
        await ctx.replaceImageByCustomId(String(opts.replaceTargetId), asset.url)
    } else {
        await ctx.insertAssetToCanvas(asset)
    }

    ctx.aiStudio.handleCreated(asset)
    ctx.aiStudio.open.value = false
}

export const openLocalProductImagePicker = (
    ctx: EditorProductImageActionsContext,
    mode: ProductImageMode,
    opts: { imageId?: string | null; cardId?: string | null } = {}
) => {
    ctx.pendingLocalImageActionMode.value = mode
    ctx.pendingImageReplaceTargetId.value = mode === 'replace' ? (opts.imageId || null) : null
    ctx.pendingImageAddCardId.value = mode === 'add' ? (opts.cardId || null) : null
    if (ctx.fileInput.value) {
        ctx.fileInput.value.value = ''
        ctx.fileInput.value.click()
    }
}

export const openProductImageUploadPickerModal = async (
    ctx: EditorProductImageActionsContext,
    mode: ProductImageMode,
    opts: { imageId?: string | null; cardId?: string | null; search?: string | null } = {}
) => {
    ctx.productImagePickerMode.value = mode
    ctx.productImagePickerTargetImageId.value = mode === 'replace' ? (opts.imageId || null) : null
    ctx.productImagePickerTargetCardId.value = mode === 'add' ? (opts.cardId || null) : null
    ctx.productImagePickerSearch.value = String(opts.search || '').trim()
    ctx.showProductImageUploadPicker.value = true
    await (ctx.refreshProductImagePickerAssets || ctx.refreshAiStudioUploads)()
}

export const applyProductImageFromUploadPicker = async (
    ctx: EditorProductImageActionsContext,
    asset: ProductImageAsset
) => {
    if (!asset?.url || ctx.productImagePickerLoading?.value) return
    if (ctx.productImagePickerLoading) ctx.productImagePickerLoading.value = true
    if (ctx.productImagePickerError) ctx.productImagePickerError.value = ''
    let applied = false

    try {
        // A chave vem do índice do Wasabi. Passá-la adiante evita tentar
        // baixar uma URL assinada temporária quando o processamento de fundo
        // começa, o que deixava a troca aguardando sem aplicar a seleção.
        const imageUrl = await preparePickerImage(ctx, asset)
        if (ctx.productImagePickerMode.value === 'replace' && ctx.productImagePickerTargetImageId.value) {
            if (!await ctx.replaceImageByCustomId(ctx.productImagePickerTargetImageId.value, imageUrl, { scope: ctx.productImageReplaceScope?.value || 'single' })) {
                throw new Error('Não foi possível substituir a imagem. Selecione novamente a imagem do produto.')
            }
            applied = true
        } else if (ctx.productImagePickerMode.value === 'add' && ctx.productImagePickerTargetCardId.value) {
            const targetCard = ctx.findProductCardByCustomId(ctx.productImagePickerTargetCardId.value)
            if (!targetCard) {
                throw new Error('Card de produto não encontrado.')
            }
            if (!await ctx.addImageToProductCardByUrl(targetCard, imageUrl)) {
                throw new Error('Não foi possível adicionar a imagem ao card.')
            }
            applied = true
        } else {
            throw new Error('Selecione novamente a imagem do produto antes de trocar.')
        }
    } catch (error: any) {
        const message = error?.message || 'Não foi possível remover o fundo. A imagem anterior foi mantida.'
        if (ctx.productImagePickerError) ctx.productImagePickerError.value = message
        ctx.notifyEditorError(message)
    } finally {
        if (ctx.productImagePickerLoading) ctx.productImagePickerLoading.value = false
        // Em caso de falha a biblioteca continua aberta, com o erro visível e
        // o alvo preservado. Assim o clique não parece ter sido ignorado.
        if (applied) {
            ctx.showProductImageUploadPicker.value = false
            clearPendingProductImageOperation(ctx)
        }
    }
}

export const handleFileUpload = async (
    ctx: EditorProductImageActionsContext,
    event: any
) => {
    const input = event?.target as HTMLInputElement | null
    const files = Array.from(input?.files || []).filter(Boolean) as File[]
    if (input) input.value = ''
    if (!files.length) {
        clearPendingProductImageOperation(ctx)
        return
    }

    try {
        const mode = ctx.pendingLocalImageActionMode.value
        const replaceTargetId = ctx.pendingImageReplaceTargetId.value
        if (mode === 'replace' && !replaceTargetId) throw new Error('Selecione novamente a imagem que deseja substituir.')

        if (mode === 'replace' && replaceTargetId) {
            const file = files[0]
            if (!file) {
                clearPendingProductImageOperation(ctx)
                return
            }
            const uploaded = await ctx.uploadFile(await trimImageFile(file), { removeBackground: true })
            if (!uploaded?.success || !uploaded?.url) throw new Error('Upload falhou')
            if (!await ctx.replaceImageByCustomId(replaceTargetId, uploaded.url, { scope: ctx.productImageReplaceScope?.value || 'single' })) {
                throw new Error('Não foi possível substituir a imagem do produto.')
            }
            return
        }

        if (mode === 'add' && ctx.pendingImageAddCardId.value) {
            const card = ctx.findProductCardByCustomId(ctx.pendingImageAddCardId.value)
            if (!card) throw new Error('Card de produto não encontrado.')

            for (const file of files) {
                const uploaded = await ctx.uploadFile(await trimImageFile(file), { removeBackground: true })
                if (!uploaded?.success || !uploaded?.url) throw new Error('Upload falhou')
                const added = await ctx.addImageToProductCardByUrl(card, uploaded.url)
                if (!added) throw new Error('Não foi possível adicionar imagem ao card.')
            }
            return
        }

        const base = ctx.getCenterOfView()
        const cols = Math.max(1, Math.ceil(Math.sqrt(files.length)))
        const gap = 34
        for (let i = 0; i < files.length; i++) {
            const file = files[i]!
            const uploaded = await ctx.uploadFile(await trimImageFile(file))
            if (!uploaded?.success || !uploaded?.url) throw new Error('Upload falhou')
            const row = Math.floor(i / cols)
            const col = i % cols
            const pos = { x: base.x + (col * gap), y: base.y + (row * gap) }
            await ctx.insertAssetToCanvas({
                id: ctx.makeCanvasObjectId(),
                name: file.name || 'Imagem',
                url: uploaded.url
            }, { pos })
        }
    } catch (err: any) {
        console.error('❌ [upload] Erro ao processar imagem:', err)
        ctx.notifyEditorError('Erro ao enviar imagem: ' + (err?.message || 'Erro desconhecido'))
    } finally {
        clearPendingProductImageOperation(ctx)
    }
}

const resolvePasteTargetProductCard = (
    ctx: EditorProductImageActionsContext,
    activeObj: any
) => {
    if (!activeObj || !ctx.canvas.value) return null

    if (
        activeObj.type === 'group' &&
        (activeObj.isSmartObject || activeObj.isProductCard || ctx.isLikelyProductCard(activeObj))
    ) {
        return activeObj
    }

    if (String(activeObj.type || '').toLowerCase() === 'image') {
        const allObjects = ctx.canvas.value.getObjects()
        for (const obj of allObjects) {
            if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || ctx.isLikelyProductCard(obj))) {
                if (typeof obj.getObjects === 'function') {
                    const children = obj.getObjects()
                    const containsImage = children.some((child: any) =>
                        child === activeObj || child._customId === activeObj._customId
                    )
                    if (containsImage) return obj
                }
            }
        }
        return null
    }

    const parentGroup = (activeObj as any)?.group
    if (parentGroup?.isSmartObject || parentGroup?.isProductCard || ctx.isLikelyProductCard(parentGroup)) {
        return parentGroup
    }

    return null
}

export const handleClipboardImagePaste = async (
    ctx: EditorProductImageActionsContext,
    event: ClipboardEvent
) => {
    if (!event.clipboardData || !ctx.canvas.value) return
    const items = event.clipboardData.items

    for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (!item || item.type.indexOf('image') === -1) continue

            event.preventDefault()
            const file = item.getAsFile()
            if (!file) continue

            try {
                const result = await ctx.uploadFile(await trimImageFile(file))
            if (!result.success || !result.url) continue

            const pasteProxyUrl = ctx.toWasabiProxyUrl(result.url) || result.url
            const img = await ctx.fabric.Image.fromURL(pasteProxyUrl, { crossOrigin: 'anonymous' })
            if (!img) continue

            autoTrimFabricImage(img, {
                alphaThreshold: 12,
                padding: 0,
                colorTolerance: 20,
                preserveVisualPosition: true
            })

            if (img.width > 500) {
                img.scaleToWidth(500)
            }

            ;(img as any)._customId = ctx.makeId()
            const activeObj = ctx.canvas.value.getActiveObject()
            const targetProductCard = resolvePasteTargetProductCard(ctx, activeObj)

            if (targetProductCard) {
                console.log('📦 [handlePaste] Pasting image into product card:', targetProductCard._customId || targetProductCard.name)

                const groupChildren = typeof targetProductCard.getObjects === 'function'
                    ? targetProductCard.getObjects()
                    : []
                const existingProductImage = groupChildren.find((child: any) =>
                    String(child.type || '').toLowerCase() === 'image' &&
                    (child.name === 'smart_image' || child.name === 'product_image' || child.name === 'productImage')
                ) || groupChildren.find((child: any) => String(child.type || '').toLowerCase() === 'image')

                const targetLeft = existingProductImage ? (Number(existingProductImage.left) || 0) + 10 : 0
                const targetTop = existingProductImage ? (Number(existingProductImage.top) || 0) + 10 : 0
                const targetCanvas = ctx.groupLocalToCanvasPoint(targetProductCard, targetLeft, targetTop)
                img.set({
                    left: targetCanvas.x,
                    top: targetCanvas.y,
                    originX: 'center',
                    originY: 'center',
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true
                })

                ctx.safeAddWithUpdate(targetProductCard, img)
                targetProductCard.set({ subTargetCheck: true, interactive: true })
                targetProductCard.setCoords?.()
                targetProductCard.dirty = true

                ctx.canvas.value.setActiveObject(img)
                ctx.safeRequestRenderAll()
                ctx.refreshCanvasObjects()
                ctx.saveCurrentState()
                continue
            }

            const center = ctx.getCenterOfView()
            img.set({
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center'
            })

            ctx.canvas.value.add(img)
            ctx.canvas.value.setActiveObject(img)
            ctx.safeRequestRenderAll()
            ctx.saveCurrentState()
        } catch (err) {
            console.error('Paste upload failed', err)
        }
    }
}
