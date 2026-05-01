/**
 * Helpers puros para escolher intervalo de refresh adaptativo baseado
 * no tamanho do canvas. Quanto mais objetos, maior o intervalo entre
 * refreshes (evita travar a UI durante render pesado).
 *
 * Cobertura: tests/utils/refreshThrottle.test.ts
 */

/**
 * Intervalo minimo padrao (em ms) para refresh do estado de objetos
 * do canvas. ~42ms = 24 FPS, balanco UX/perf.
 */
export const CANVAS_OBJECTS_REFRESH_MIN_INTERVAL_MS = 42

/**
 * Calcula intervalo adaptativo baseado no `objectCount` atual:
 *  - > 1000 objetos: 220ms (~4.5 FPS) — projetos pesados
 *  - > 650:          160ms (~6 FPS)
 *  - > 320:           96ms (~10 FPS)
 *  - > 180:           64ms (~15 FPS)
 *  - <= 180:          MIN_INTERVAL_MS (42ms ~ 24 FPS)
 *
 * Recebe `objectCount` ja resolvido (caller injeta de
 * canvas.getObjects().length ou ref reativa).
 */
export const getCanvasObjectsRefreshIntervalMs = (objectCount: number): number => {
    const n = Number(objectCount) || 0
    if (n > 1000) return 220
    if (n > 650) return 160
    if (n > 320) return 96
    if (n > 180) return 64
    return CANVAS_OBJECTS_REFRESH_MIN_INTERVAL_MS
}
