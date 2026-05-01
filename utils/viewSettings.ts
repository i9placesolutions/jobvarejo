/**
 * Helpers puros para parse/serialize das view settings persistidas em
 * localStorage (grid, rulers, guides, snaps, grid size).
 *
 * Cobertura: tests/utils/viewSettings.test.ts
 */

/**
 * Chave usada em localStorage para persistir view settings. Versionada
 * (`:v1`) para permitir invalidar persistencia antiga quando o shape
 * de ViewSettings mudar.
 */
export const VIEW_SETTINGS_STORAGE_KEY = 'editor:viewSettings:v1'

export type ViewSettings = {
    viewShowGrid: boolean
    viewShowRulers: boolean
    viewShowGuides: boolean
    snapToObjects: boolean
    snapToGuides: boolean
    snapToGrid: boolean
    gridSize: number
}

export type PartialViewSettings = Partial<ViewSettings>

/**
 * Parse defensivo das view settings a partir do raw armazenado em
 * localStorage. Tudo que nao bate com o tipo esperado e' DESCARTADO
 * (silenciosamente) — caller mantem default em ref reativa.
 *
 *  - JSON invalido → {}
 *  - boolean campos so aceitam true/false (numero/string nao)
 *  - gridSize: Number finito > 0, arredondado
 *  - falha geral: {}
 */
export const parseViewSettings = (raw: string | null | undefined): PartialViewSettings => {
    const out: PartialViewSettings = {}
    if (!raw) return out
    try {
        const data = JSON.parse(raw || '{}') || {}
        if (typeof data.viewShowGrid === 'boolean') out.viewShowGrid = data.viewShowGrid
        if (typeof data.viewShowRulers === 'boolean') out.viewShowRulers = data.viewShowRulers
        if (typeof data.viewShowGuides === 'boolean') out.viewShowGuides = data.viewShowGuides
        if (typeof data.snapToObjects === 'boolean') out.snapToObjects = data.snapToObjects
        if (typeof data.snapToGuides === 'boolean') out.snapToGuides = data.snapToGuides
        if (typeof data.snapToGrid === 'boolean') out.snapToGrid = data.snapToGrid
        const gs = Number(data.gridSize)
        if (Number.isFinite(gs) && gs > 0) out.gridSize = Math.round(gs)
    } catch {
        // ignore — retorna parcial (talvez vazio)
    }
    return out
}

/**
 * Serializa view settings para JSON estavel (campos em ordem fixa).
 */
export const serializeViewSettings = (settings: ViewSettings): string => {
    return JSON.stringify({
        viewShowGrid: settings.viewShowGrid,
        viewShowRulers: settings.viewShowRulers,
        viewShowGuides: settings.viewShowGuides,
        snapToObjects: settings.snapToObjects,
        snapToGuides: settings.snapToGuides,
        snapToGrid: settings.snapToGrid,
        gridSize: settings.gridSize
    })
}
