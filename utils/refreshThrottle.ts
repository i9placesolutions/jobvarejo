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
 * Calcula intervalo adaptativo (em ms) para refresh dos labels de frame
 * baseado no numero de labels existentes na pagina atual:
 *  - > 520 labels: 420ms
 *  - > 320:        320ms
 *  - > 240:        280ms
 *  - > 120:        180ms
 *  - > 60:         120ms
 *  - <= 60:         80ms
 *
 * Frame labels sao caros de renderizar (texto + posicionamento +
 * rotacao). Em projetos com muitos frames vale rodar menos
 * frequentemente para preservar fluidez.
 */
export const getFrameLabelUpdateIntervalMs = (count: number): number => {
    const c = Number(count) || 0
    if (c > 520) return 420
    if (c > 320) return 320
    if (c > 240) return 280
    if (c > 120) return 180
    if (c > 60) return 120
    return 80
}

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
