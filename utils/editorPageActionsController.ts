export type EditorPageActionsContext = {
    project: { pages?: any[]; activePageIndex: number }
    showDeletePageModal: { value: boolean }
    makeId: () => string
    deletePage: (pageIndex: number) => void
}

export const switchToPage = (
    ctx: EditorPageActionsContext,
    pageId: string
) => {
    const idx = ctx.project.pages?.findIndex((p: any) => p.id === pageId)
    if (idx != null && idx >= 0 && idx !== ctx.project.activePageIndex) {
        ctx.project.activePageIndex = idx
    }
}

export const addNewPage = (ctx: EditorPageActionsContext) => {
    const newPage: any = {
        id: ctx.makeId(),
        name: `Página ${(ctx.project.pages?.length || 0) + 1}`,
        width: 1080,
        height: 1080,
        type: 'FREE_DESIGN',
        canvasData: null,
        dirty: true
    }
    if (!ctx.project.pages) ctx.project.pages = []
    ctx.project.pages.push(newPage)
    ctx.project.activePageIndex = ctx.project.pages.length - 1
}

export const duplicatePage = (
    ctx: EditorPageActionsContext,
    pageId: string
) => {
    const idx = ctx.project.pages?.findIndex((p: any) => p.id === pageId)
    if (idx == null || idx < 0) return
    const src = ctx.project.pages?.[idx]
    if (!src) return
    const dup = {
        ...JSON.parse(JSON.stringify(src)),
        id: ctx.makeId(),
        name: `${src.name || 'Página'} (cópia)`,
        dirty: true
    }
    ctx.project.pages!.splice(idx + 1, 0, dup)
    ctx.project.activePageIndex = idx + 1
}

export const reorderPages = (
    ctx: EditorPageActionsContext,
    orderedIds: string[]
) => {
    if (!orderedIds || !ctx.project.pages) return
    const map = new Map(ctx.project.pages.map((p: any) => [p.id, p]))
    const reordered = orderedIds.map((id: string) => map.get(id)).filter(Boolean) as any[]
    const remaining = ctx.project.pages.filter((p: any) => !orderedIds.includes(p.id))
    ctx.project.pages = [...reordered, ...remaining]
}

export const handleDeleteCurrentPage = (ctx: EditorPageActionsContext) => {
    if ((ctx.project.pages?.length || 0) <= 1) return
    ctx.showDeletePageModal.value = true
}

export const confirmDeletePage = (ctx: EditorPageActionsContext) => {
    ctx.deletePage(ctx.project.activePageIndex)
    ctx.showDeletePageModal.value = false
}
