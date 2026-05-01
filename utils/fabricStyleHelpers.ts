/**
 * Helpers puros de estilo/forma sobre objetos Fabric: detectar tipo
 * rect, clamp de raios de canto, detectar cor "transparente", operar
 * fill com backup/restore.
 *
 * Sem dependencia de canvas, refs reativos ou estado global. Operam
 * apenas no objeto duck-typed passado como argumento.
 *
 * Cobertura: tests/utils/fabricStyleHelpers.test.ts
 */

/**
 * Detecta um fabric.Rect (case-insensitive).
 */
export const isRectObject = (obj: any): boolean =>
    String(obj?.type || '').toLowerCase() === 'rect'

/**
 * Tipo dos 4 raios de canto. Cada raio e' clampado individualmente
 * em [0, w/2] e [0, h/2] para evitar overflow visual.
 */
export type CornerRadii = { tl: number; tr: number; br: number; bl: number }

/**
 * Clampa raios de canto contra a largura e altura do rect, garantindo
 * que nenhum raio exceda metade da menor dimensao (forma extrema vira
 * pill em vez de visual quebrado).
 *
 * Aceita qualquer valor numerico ou string-parseavel; valores negativos
 * sao zero, NaN vira zero.
 */
export const clampCornerRadii = (radii: any, w: number, h: number): CornerRadii => {
    const clamp = (n: any): number => {
        const v = Math.max(0, Number(n || 0))
        return Math.min(v, w / 2, h / 2)
    }
    return {
        tl: clamp(radii?.tl),
        tr: clamp(radii?.tr),
        br: clamp(radii?.br),
        bl: clamp(radii?.bl)
    }
}

/**
 * Detecta uma "cor transparente" segundo o que o editor considera
 * "sem fill efetivo": null, undefined, '', 'transparent', ou rgba(...,0).
 *
 * Util para decidir se um objeto deve ter fill restaurado de backup
 * (toggleFill) ou se um clipPath/border esta efetivamente desabilitado.
 */
export const isTransparentPaint = (v: any): boolean => {
    if (v == null) return true
    if (v === '' || v === 'transparent') return true
    if (typeof v !== 'string') return false
    return v.startsWith('rgba') && v.replace(/\s/g, '').endsWith(',0)')
}

/**
 * Liga/desliga o fill de um objeto Fabric preservando o valor anterior.
 *
 * - Hide: salva fill atual em __fillBackup e aplica rgba(0,0,0,0).
 * - Show: restaura __fillBackup se nao-transparente, senao usa fill
 *   atual se nao-transparente, senao default '#ffffff'.
 *
 * Operacao mutativa; no-op silencioso se obj e null.
 */
export const toggleFill = (obj: any, enabled: boolean): void => {
    if (!obj) return
    ;(obj as any).__fillEnabled = !!enabled
    if (enabled) {
        const prev = (obj as any).__fillBackup
        const next = !isTransparentPaint(prev)
            ? prev
            : (!isTransparentPaint(obj.fill) ? obj.fill : '#ffffff')
        obj.set?.('fill', next)
    } else {
        ;(obj as any).__fillBackup = obj.fill
        obj.set?.('fill', 'rgba(0,0,0,0)')
    }
}
