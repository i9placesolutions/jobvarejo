type AiPageType = 'RETAIL_OFFER' | 'FREE_DESIGN'
type AiApplyMode = 'replace' | 'newPage'

export type GenerateFlyerWithAiPayload = {
    mode: AiApplyMode
    pageType: AiPageType
    pageWidth: number
    pageHeight: number
    referenceImageDataUrl?: string | null
    cloneStrength?: number
}

export type GenerateInstitutionalPayload = {
    prompt: string
    size: string
    title: string
    subtitle: string
    tagFilter: string
}

export type EditorAiGenerationContext = {
    project: { id?: string; activePageIndex: number }
    activePage: { value: { id?: string; type?: AiPageType } | null | undefined }
    aiPrompt: { value: string }
    aiReferenceImageDataUrl: { value: string | null }
    aiApplyMode: { value: AiApplyMode }
    aiPageType: { value: AiPageType }
    aiPageWidth: { value: number }
    aiPageHeight: { value: number }
    isProcessing: { value: boolean }
    showAIModal: { value: boolean }
    pageReloadToken: { value: number }
    pushAiToast: (type: 'success' | 'error' | 'info', message: string) => void
    updatePageData: (pageIndex: number, canvasData: any, opts?: any) => void
    saveProjectDB: () => Promise<void>
}

export const generateFlyerWithAI = async (
    ctx: EditorAiGenerationContext,
    payload: GenerateFlyerWithAiPayload
) => {
    const prompt = String(ctx.aiPrompt.value || '').trim()
    const referenceImageDataUrl = String(
        payload?.referenceImageDataUrl || ctx.aiReferenceImageDataUrl.value || ''
    ).trim()
    if (!prompt && !referenceImageDataUrl) {
        ctx.pushAiToast('error', 'Informe o tema/estilo ou envie uma imagem para clonar.')
        return
    }

    const width = Math.max(64, Math.round(Number(payload?.pageWidth || ctx.aiPageWidth.value || 1080)))
    const height = Math.max(64, Math.round(Number(payload?.pageHeight || ctx.aiPageHeight.value || 1920)))
    const mode = payload?.mode || ctx.aiApplyMode.value
    const pageType = payload?.pageType || ctx.aiPageType.value

    ctx.isProcessing.value = true
    try {
        const { applyAiToPage } = await import('~/src/ai/aiApplyToProject')
        const result = await applyAiToPage({
            projectId: String(ctx.project.id || ''),
            pageId: mode === 'replace' ? String(ctx.activePage.value?.id || '') : null,
            mode,
            prompt,
            options: {
                pageType,
                size: { width, height },
                referenceImageDataUrl: referenceImageDataUrl || null,
                cloneStrength: referenceImageDataUrl ? Math.max(0, Math.min(100, Number(payload?.cloneStrength ?? 100))) : undefined
            }
        })

        ctx.pageReloadToken.value++
        ctx.showAIModal.value = false
        ctx.aiReferenceImageDataUrl.value = null
        ctx.pushAiToast('success', mode === 'newPage' ? 'Página com IA criada com sucesso.' : 'Página atual atualizada com IA.')
        console.log('[ai] Página gerada:', result)
    } catch (err: any) {
        console.error('[ai] Falha ao gerar página:', err)
        const message = String(err?.data?.statusMessage || err?.statusMessage || err?.message || 'Erro ao gerar página com IA.')
        ctx.pushAiToast('error', message)
    } finally {
        ctx.isProcessing.value = false
    }
}

export const handleGenerateInstitutional = async (
    ctx: EditorAiGenerationContext,
    payload: GenerateInstitutionalPayload
) => {
    if (!payload.prompt.trim()) {
        ctx.pushAiToast('error', 'Informe o que deseja criar.')
        return
    }

    ctx.isProcessing.value = true
    try {
        const result = await $fetch<{
            success: boolean
            imageUrl: string
            imageKey: string
            canvasData: any
            styleNotesUsed: string | null
            inspirationsUsed: number
        }>('/api/ai/institutional/generate', {
            method: 'POST',
            body: payload
        })

        if (!result?.canvasData) {
            ctx.pushAiToast('error', 'A geração não retornou dados válidos.')
            return
        }

        const pageIndex = ctx.project.activePageIndex
        ctx.updatePageData(pageIndex, result.canvasData, {
            source: 'user',
            markUnsaved: true,
            reason: 'institutional-ai-generate'
        })
        ctx.pageReloadToken.value++

        const inspirationMsg = result.inspirationsUsed > 0
            ? ` (baseado em ${result.inspirationsUsed} inspiracao(oes))`
            : ''
        ctx.pushAiToast('success', `Arte institucional gerada com sucesso${inspirationMsg}. Edite textos e elementos a vontade.`)

        try {
            await ctx.saveProjectDB()
        } catch (saveErr) {
            console.error('[ai:institutional] Falha ao salvar projeto após geração de arte:', saveErr)
            ctx.pushAiToast('error', 'Arte gerada mas falha ao salvar. Tente salvar manualmente.')
        }

        console.log('[ai:institutional] Arte gerada:', {
            imageKey: result.imageKey,
            styleNotes: result.styleNotesUsed,
            inspirations: result.inspirationsUsed
        })
    } catch (err: any) {
        console.error('[ai:institutional] Falha:', err)
        const message = String(err?.data?.statusMessage || err?.statusMessage || err?.message || 'Erro ao gerar arte institucional.')
        ctx.pushAiToast('error', message)
    } finally {
        ctx.isProcessing.value = false
    }
}
