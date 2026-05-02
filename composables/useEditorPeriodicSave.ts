import { onMounted, onUnmounted, type Ref } from 'vue'
import { PERIODIC_SAVE_INTERVAL_MS } from '~/utils/editorSavePolicy'

type UseEditorPeriodicSaveOptions = {
    isCanvasDestroyed: Ref<boolean>
    project: {
        id?: string
        pages: any[]
    }
    hasUnsavedChanges: Ref<boolean>
    flushAutoSave: () => Promise<void>
}

export const useEditorPeriodicSave = ({
    isCanvasDestroyed,
    project,
    hasUnsavedChanges,
    flushAutoSave
}: UseEditorPeriodicSaveOptions) => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    onMounted(() => {
        intervalId = setInterval(() => {
            if (isCanvasDestroyed.value) return
            if (!project.id || project.id.startsWith('proj_')) return
            if (!hasUnsavedChanges.value && !project.pages.some((p: any) => !!p?.dirty)) return
            void flushAutoSave().catch(() => {
                // Periodic save is best-effort; explicit save paths still report errors.
            })
        }, PERIODIC_SAVE_INTERVAL_MS)
    })

    onUnmounted(() => {
        if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
        }
    })
}
