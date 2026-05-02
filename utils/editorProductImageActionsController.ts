type ProductImageMode = 'replace' | 'add'

type ProductImageAsset = { id?: string; name?: string; url: string }

export type EditorProductImageActionsContext = {
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
    refreshAiStudioUploads: () => Promise<void>
    replaceImageByCustomId: (targetId: string, newUrl: string, opts?: { save?: boolean; setActive?: boolean }) => Promise<boolean>
    insertAssetToCanvas: (asset: ProductImageAsset, opts?: { pos?: { x: number; y: number } }) => Promise<void>
    findProductCardByCustomId: (id: string) => any | null
    addImageToProductCardByUrl: (card: any, newUrl: string, opts?: { save?: boolean; setActive?: boolean }) => Promise<boolean>
    uploadFile: (file: File) => Promise<{ success?: boolean; url?: string }>
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
    opts: { imageId?: string | null; cardId?: string | null } = {}
) => {
    ctx.productImagePickerMode.value = mode
    ctx.productImagePickerTargetImageId.value = mode === 'replace' ? (opts.imageId || null) : null
    ctx.productImagePickerTargetCardId.value = mode === 'add' ? (opts.cardId || null) : null
    ctx.productImagePickerSearch.value = ''
    ctx.showProductImageUploadPicker.value = true
    await ctx.refreshAiStudioUploads()
}

export const applyProductImageFromUploadPicker = async (
    ctx: EditorProductImageActionsContext,
    asset: ProductImageAsset
) => {
    if (!asset?.url) return

    try {
        if (ctx.productImagePickerMode.value === 'replace' && ctx.productImagePickerTargetImageId.value) {
            await ctx.replaceImageByCustomId(ctx.productImagePickerTargetImageId.value, asset.url)
        } else if (ctx.productImagePickerMode.value === 'add' && ctx.productImagePickerTargetCardId.value) {
            const targetCard = ctx.findProductCardByCustomId(ctx.productImagePickerTargetCardId.value)
            if (!targetCard) {
                ctx.notifyEditorError('Card de produto não encontrado.')
                return
            }
            await ctx.addImageToProductCardByUrl(targetCard, asset.url)
        }
    } finally {
        ctx.showProductImageUploadPicker.value = false
        clearPendingProductImageOperation(ctx)
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

        if (mode === 'replace' && ctx.pendingImageReplaceTargetId.value) {
            const file = files[0]
            if (!file) {
                clearPendingProductImageOperation(ctx)
                return
            }
            const uploaded = await ctx.uploadFile(file)
            if (!uploaded?.success || !uploaded?.url) throw new Error('Upload falhou')
            await ctx.replaceImageByCustomId(ctx.pendingImageReplaceTargetId.value, uploaded.url)
            return
        }

        if (mode === 'add' && ctx.pendingImageAddCardId.value) {
            const card = ctx.findProductCardByCustomId(ctx.pendingImageAddCardId.value)
            if (!card) throw new Error('Card de produto não encontrado.')

            for (const file of files) {
                const uploaded = await ctx.uploadFile(file)
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
            const uploaded = await ctx.uploadFile(file)
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
            const result = await ctx.uploadFile(file)
            if (!result.success || !result.url) continue

            const pasteProxyUrl = ctx.toWasabiProxyUrl(result.url) || result.url
            const img = await ctx.fabric.Image.fromURL(pasteProxyUrl, { crossOrigin: 'anonymous' })
            if (!img) continue

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
