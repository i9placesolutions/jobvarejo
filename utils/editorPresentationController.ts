export type EditorPresentationContext = {
    canvas: any
    project: { activePageIndex: number }
    showPresentationModal: { value: boolean }
    presentationImage: { value: string }
    presentationHotspots: { value: any[] }
    safeRequestRenderAll: () => void
    sanitizeAllClipPaths: () => void
    removeAllClipPaths: () => void
}

export const startPresentation = async (
    ctx: EditorPresentationContext,
    pageIndex = -1
) => {
    if (!ctx.canvas) return

    const targetIndex = pageIndex >= 0 ? pageIndex : ctx.project.activePageIndex
    if (targetIndex !== ctx.project.activePageIndex) {
        ctx.project.activePageIndex = targetIndex
        await new Promise(r => setTimeout(r, 200))
    }

    ctx.canvas.discardActiveObject()
    ctx.safeRequestRenderAll()
    ctx.sanitizeAllClipPaths()

    try {
        ctx.presentationImage.value = ctx.canvas.toDataURL({
            format: 'png',
            multiplier: 2
        })
    } catch (err) {
        console.error('[Prototype] Erro ao gerar imagem:', err)
        ctx.removeAllClipPaths()
        try {
            ctx.safeRequestRenderAll()
            await new Promise(resolve => setTimeout(resolve, 10))
            ctx.presentationImage.value = ctx.canvas.toDataURL({
                format: 'png',
                multiplier: 2
            })
        } catch (err2) {
            console.error('[Prototype] Falha definitiva ao gerar imagem:', err2)
            ctx.presentationImage.value = ''
        }
    }

    const vWidth = ctx.canvas.getWidth()
    const vHeight = ctx.canvas.getHeight()
    const objects = ctx.canvas.getObjects()

    ctx.presentationHotspots.value = objects
        .filter((o: any) => o.interactionDestination !== undefined && o.interactionDestination !== '')
        .map((o: any) => {
            const boundingRect = o.getBoundingRect()
            return {
                top: (boundingRect.top / vHeight) * 100 + '%',
                left: (boundingRect.left / vWidth) * 100 + '%',
                width: (boundingRect.width / vWidth) * 100 + '%',
                height: (boundingRect.height / vHeight) * 100 + '%',
                target: o.interactionDestination
            }
        })

    ctx.showPresentationModal.value = true
}
