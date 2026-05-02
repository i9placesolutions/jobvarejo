import { onMounted, onUnmounted, type Ref } from 'vue'

type UseEditorLifecyclePersistenceOptions = {
    project: {
        pages: any[]
    }
    hasUnsavedChanges: Ref<boolean>
    flushPersistenceNow: (reason: string, opts?: { force?: boolean }) => Promise<void> | void
    emergencySnapshotDirtyPages: () => void
    handleOpenPageHistoryEvent: (event: Event) => void
}

export const useEditorLifecyclePersistence = ({
    project,
    hasUnsavedChanges,
    flushPersistenceNow,
    emergencySnapshotDirtyPages,
    handleOpenPageHistoryEvent
}: UseEditorLifecyclePersistenceOptions) => {
    const hasDirtyPages = () => project.pages.some((p: any) => !!p?.dirty)

    const emergencyBeaconSave = () => {
        try {
            if (!hasUnsavedChanges.value && !hasDirtyPages()) return
            emergencySnapshotDirtyPages()
            console.log('[beacon] Snapshot local de emergencia atualizado; persistencia inline no banco desabilitada.')
        } catch (err) {
            console.warn('[beacon] Erro no emergency save:', err)
        }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        flushPersistenceNow('beforeunload')
        emergencyBeaconSave()
        if (hasUnsavedChanges.value || hasDirtyPages()) {
            e.preventDefault()
            e.returnValue = ''
        }
    }

    const handlePageHide = () => {
        flushPersistenceNow('pagehide')
        emergencyBeaconSave()
    }

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            flushPersistenceNow('visibility-hidden')
        }
    }

    onMounted(() => {
        window.addEventListener('beforeunload', handleBeforeUnload)
        window.addEventListener('pagehide', handlePageHide)
        window.addEventListener('editor:open-page-history', handleOpenPageHistoryEvent as EventListener)
        document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onUnmounted(() => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('pagehide', handlePageHide)
        window.removeEventListener('editor:open-page-history', handleOpenPageHistoryEvent as EventListener)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
}
