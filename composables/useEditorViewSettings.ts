import { onMounted, onUnmounted, ref, watch } from 'vue'
import { parseViewSettings, serializeViewSettings, VIEW_SETTINGS_STORAGE_KEY } from '~/utils/viewSettings'

export const useEditorViewSettings = () => {
    const viewShowGrid = ref(false)
    const viewShowRulers = ref(true)
    const viewShowGuides = ref(true)
    const snapToObjects = ref(true)
    const snapToGuides = ref(true)
    const snapToGrid = ref(false)
    const gridSize = ref(20)

    let saveTimer: ReturnType<typeof setTimeout> | null = null

    const load = () => {
        if (!import.meta.client) return
        try {
            const parsed = parseViewSettings(localStorage.getItem(VIEW_SETTINGS_STORAGE_KEY))
            if (parsed.viewShowGrid !== undefined) viewShowGrid.value = parsed.viewShowGrid
            if (parsed.viewShowRulers !== undefined) viewShowRulers.value = parsed.viewShowRulers
            if (parsed.viewShowGuides !== undefined) viewShowGuides.value = parsed.viewShowGuides
            if (parsed.snapToObjects !== undefined) snapToObjects.value = parsed.snapToObjects
            if (parsed.snapToGuides !== undefined) snapToGuides.value = parsed.snapToGuides
            if (parsed.snapToGrid !== undefined) snapToGrid.value = parsed.snapToGrid
            if (parsed.gridSize !== undefined) gridSize.value = parsed.gridSize
        } catch {
            // Keep defaults when persisted settings are unavailable or malformed.
        }
    }

    const persist = () => {
        if (!import.meta.client) return
        try {
            localStorage.setItem(VIEW_SETTINGS_STORAGE_KEY, serializeViewSettings({
                viewShowGrid: viewShowGrid.value,
                viewShowRulers: viewShowRulers.value,
                viewShowGuides: viewShowGuides.value,
                snapToObjects: snapToObjects.value,
                snapToGuides: snapToGuides.value,
                snapToGrid: snapToGrid.value,
                gridSize: gridSize.value
            }))
        } catch {
            // Ignore storage quota/private-mode failures.
        }
    }

    onMounted(load)

    watch(
        [viewShowGrid, viewShowRulers, viewShowGuides, snapToObjects, snapToGuides, snapToGrid, gridSize],
        () => {
            if (saveTimer) clearTimeout(saveTimer)
            saveTimer = setTimeout(() => persist(), 200)
        },
        { deep: false }
    )

    onUnmounted(() => {
        if (saveTimer) {
            clearTimeout(saveTimer)
            saveTimer = null
        }
    })

    return {
        viewShowGrid,
        viewShowRulers,
        viewShowGuides,
        snapToObjects,
        snapToGuides,
        snapToGrid,
        gridSize,
        load,
        persist
    }
}
