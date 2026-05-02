import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { findPageIndexById } from '~/utils/editorPageLookup'
import type { PageHistoryItem } from '~/utils/pageHistoryHelpers'

type UseEditorPageRecoveryOptions = {
    project: {
        id?: string
        pages: any[]
        activePageIndex: number
    }
    activePage: ComputedRef<any>
    showDesignLoaderOverlay: ComputedRef<boolean>
    storageDegraded: Ref<boolean>
    storageDegradedHint: Ref<string>
    storageDegradedFailedCount: Ref<number | null>
    pageReloadToken: Ref<number>
    getApiAuthHeaders: () => Promise<Record<string, string>>
    updatePageData: (pageIndex: number, canvasData: any, options?: any) => void
    getActiveProjectPageId: () => string
    resetLoadedPageCache: () => void
}

export const useEditorPageRecovery = ({
    project,
    activePage,
    showDesignLoaderOverlay,
    storageDegraded,
    storageDegradedHint,
    storageDegradedFailedCount,
    pageReloadToken,
    getApiAuthHeaders,
    updatePageData,
    getActiveProjectPageId,
    resetLoadedPageCache
}: UseEditorPageRecoveryOptions) => {
    const showStorageDegradedBanner = computed(() => storageDegraded.value && !showDesignLoaderOverlay.value)

    const retryStorageReload = () => {
        storageDegraded.value = false
        storageDegradedHint.value = ''
        storageDegradedFailedCount.value = null
        // Force re-run of the page loader watch even if the page id didn't change.
        resetLoadedPageCache()
        pageReloadToken.value++
    }

    const canRecoverLatestNonEmpty = computed(() => {
        const pid = String(project.id || '').trim()
        const pageId = String(activePage.value?.id || '').trim()
        return !!pid && !pid.startsWith('proj_') && !!pageId
    })

    const isRecoveringLatestNonEmpty = ref(false)
    const recoverLatestNonEmptyForActivePage = async () => {
        if (!canRecoverLatestNonEmpty.value || isRecoveringLatestNonEmpty.value) return
        const pid = String(project.id || '').trim()
        const pageId = String(activePage.value?.id || '').trim()
        if (!pid || !pageId) return
        const capturedPageId = pageId

        const ok = typeof window !== 'undefined'
            ? window.confirm('Recuperar a ultima versao nao-vazia desta pagina? Isso pode desfazer alteracoes recentes.')
            : true
        if (!ok) return

        isRecoveringLatestNonEmpty.value = true
        try {
            const headers = await getApiAuthHeaders()
            const result: any = await $fetch('/api/storage/recover-latest-non-empty', {
                method: 'POST',
                headers,
                body: { projectId: pid, pageId }
            })
            if (result?.json) {
                // Sync the specific page that initiated the recovery (avoid overwriting a different
                // page if the user switched tabs/pages while this request was in-flight).
                const idx = findPageIndexById(project.pages, capturedPageId, project.activePageIndex)
                if (idx >= 0) {
                    updatePageData(idx, result.json, { source: 'system', markUnsaved: false })
                    const page = project.pages?.[idx]
                    if (page) page.canvasDataPath = String(result.key || page.canvasDataPath || '')
                }
                // Only force-reload the Fabric canvas if we're still on the same page.
                if (getActiveProjectPageId() === capturedPageId) {
                    retryStorageReload()
                }
            }
        } catch (e: any) {
            console.warn('[recovery] Falha ao recuperar versao nao-vazia:', e?.message || e)
            storageDegraded.value = true
            storageDegradedHint.value = 'Falha ao recuperar versao nao-vazia.'
        } finally {
            isRecoveringLatestNonEmpty.value = false
        }
    }

    const showHistoryModal = ref(false)
    const historyLoading = ref(false)
    const historyError = ref<string>('')
    const historyItems = ref<PageHistoryItem[]>([])

    const openHistoryModal = async () => {
        if (!canRecoverLatestNonEmpty.value) return
        const pid = String(project.id || '').trim()
        const pageId = String(activePage.value?.id || '').trim()
        if (!pid || !pageId) return

        showHistoryModal.value = true
        historyLoading.value = true
        historyError.value = ''
        historyItems.value = []

        try {
            const headers = await getApiAuthHeaders()
            const res: any = await $fetch('/api/storage/history', {
                method: 'GET',
                headers,
                query: { projectId: pid, pageId }
            })
            historyItems.value = Array.isArray(res?.items) ? res.items : []
        } catch (e: any) {
            historyError.value = String(e?.statusMessage || e?.message || 'Falha ao carregar histórico')
        } finally {
            historyLoading.value = false
        }
    }

    const restoringHistoryKey = ref<string>('')
    const restoreFromHistoryItem = async (item: PageHistoryItem) => {
        if (!item?.key || restoringHistoryKey.value) return
        if (!canRecoverLatestNonEmpty.value) return

        const ok = typeof window !== 'undefined'
            ? window.confirm('Restaurar esta versao? Isso vai substituir o conteudo atual desta pagina.')
            : true
        if (!ok) return

        restoringHistoryKey.value = `${item.source}:${item.key}:${item.versionId || ''}`
        try {
            const pid = String(project.id || '').trim()
            const pageId = String(activePage.value?.id || '').trim()
            const headers = await getApiAuthHeaders()
            const result: any = await $fetch('/api/storage/restore', {
                method: 'POST',
                headers,
                body: {
                    projectId: pid,
                    pageId,
                    source: {
                        kind: item.source,
                        key: item.key,
                        versionId: item.source === 'version' ? (item.versionId || null) : null
                    }
                }
            })
            if (result?.ok) {
                // Force the page loader to fetch fresh data from S3/DB instead of
                // reusing the stale in-memory canvasData.
                const idx = findPageIndexById(project.pages, pageId, project.activePageIndex)
                if (idx >= 0 && project.pages[idx]) {
                    project.pages[idx].canvasData = null
                    project.pages[idx].lastSavedFingerprint = undefined
                    project.pages[idx].lastLoadedFingerprint = undefined
                    project.pages[idx].dirty = false
                    // Update canvasDataPath to the restored target key so the loader
                    // fetches from the correct S3 object.
                    if (result.targetKey) {
                        project.pages[idx].canvasDataPath = result.targetKey
                    }
                    // Clear local draft so it doesn't override the restored version.
                    try { localStorage.removeItem(`jobvarejo:draft:page:${project.id}:${pageId}`) } catch (err) {
                        console.warn('[history-restore] falha ao remover draft local:', err)
                    }
                }
                showHistoryModal.value = false
                retryStorageReload()
            }
        } catch (e: any) {
            historyError.value = String(e?.statusMessage || e?.message || 'Falha ao restaurar')
        } finally {
            restoringHistoryKey.value = ''
        }
    }

    const handleOpenPageHistoryEvent = () => {
        if (!canRecoverLatestNonEmpty.value) return
        void openHistoryModal()
    }

    return {
        showStorageDegradedBanner,
        retryStorageReload,
        canRecoverLatestNonEmpty,
        isRecoveringLatestNonEmpty,
        recoverLatestNonEmptyForActivePage,
        showHistoryModal,
        historyLoading,
        historyError,
        historyItems,
        restoringHistoryKey,
        openHistoryModal,
        restoreFromHistoryItem,
        handleOpenPageHistoryEvent
    }
}
