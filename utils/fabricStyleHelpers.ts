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
 * Calcula as coordenadas de gradient linear cobrindo o objeto inteiro
 * em um angulo dado (em graus). Pure: recebe `width`, `height`, `angleDeg`
 * e retorna os 4 pontos `{ x1, y1, x2, y2 }` para usar em fabric.Gradient.
 *
 *  - angle 0: gradient horizontal direita-esquerda
 *  - angle 90: gradient vertical baixo-cima
 *  - radius = metade da maior dimensao (cobertura completa)
 *
 * O caller (componente) instancia `new fabric.Gradient({ coords, colorStops })`
 * usando essas coords.
 */
export const computeLinearGradientCoords = (
    width: number,
    height: number,
    angleDeg: number = 90
): { x1: number; y1: number; x2: number; y2: number } => {
    const w = Math.max(1, Number(width) || 1)
    const h = Math.max(1, Number(height) || 1)
    const halfW = w / 2
    const halfH = h / 2
    const radius = Math.max(w, h) / 2
    const rad = (Number(angleDeg || 0) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return {
        x1: halfW - cos * radius,
        y1: halfH - sin * radius,
        x2: halfW + cos * radius,
        y2: halfH + sin * radius
    }
}

/**
 * Constante k = 1 - 0.5522847498 para aproximacao Bezier de arco
 * quadrante. Usada por path SVG e _render patches.
 */
export const BEZIER_ARC_K = 1 - 0.5522847498

/**
 * Constroi um SVG path string para um retangulo arredondado centrado
 * em (0, 0), com cantos individuais (tl/tr/br/bl). Cada raio e clampado
 * em [0, w/2] e [0, h/2] via clampCornerRadii.
 *
 * O path usa `M`/`L`/`C`/`Z` e omite os comandos `C` quando o raio
 * correspondente e zero (canto reto).
 *
 * Pure: nao depende de fabric, refs reativos ou estado global.
 *
 * Util para fabric.Path como clipPath de objetos arredondados.
 */
export const buildRoundedRectSvgPath = (
    width: number,
    height: number,
    radii: any
): string => {
    const w = Number(width) || 0
    const h = Number(height) || 0
    const x = -w / 2
    const y = -h / 2
    const k = BEZIER_ARC_K
    const r = clampCornerRadii(radii, w, h)
    const parts = [
        `M ${x + r.tl} ${y}`,
        `L ${x + w - r.tr} ${y}`,
        r.tr ? `C ${x + w - k * r.tr} ${y} ${x + w} ${y + k * r.tr} ${x + w} ${y + r.tr}` : '',
        `L ${x + w} ${y + h - r.br}`,
        r.br ? `C ${x + w} ${y + h - k * r.br} ${x + w - k * r.br} ${y + h} ${x + w - r.br} ${y + h}` : '',
        `L ${x + r.bl} ${y + h}`,
        r.bl ? `C ${x + k * r.bl} ${y + h} ${x} ${y + h - k * r.bl} ${x} ${y + h - r.bl}` : '',
        `L ${x} ${y + r.tl}`,
        r.tl ? `C ${x} ${y + k * r.tl} ${x + k * r.tl} ${y} ${x + r.tl} ${y}` : '',
        'Z'
    ].filter(Boolean)
    return parts.join(' ')
}

/**
 * Snapshot do shadow de um text object para backup/restore. Retorna
 * null se shadow ausente; senao normaliza os 4 campos com defaults
 * seguros.
 */
export const snapshotTextShadow = (shadow: any): {
    color: string
    blur: number
    offsetX: number
    offsetY: number
} | null => {
    if (!shadow) return null
    return {
        color: String(shadow.color || 'rgba(0,0,0,0.5)'),
        blur: Number(shadow.blur || 0),
        offsetX: Number(shadow.offsetX || 0),
        offsetY: Number(shadow.offsetY || 0)
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
 * Patches `rect._render` to draw per-corner rounding (cornerRadii) usando
 * arcos Bezier. Preserva o `_render` original em `__origRender` para
 * que possa ser restaurado se cornerRadii for removido depois.
 *
 * Sem cornerRadii: restaura `_render` original (Fabric volta a usar rx/ry
 * nativo).
 *
 * Com cornerRadii: substitui `_render` por uma versao que desenha o
 * caminho usando 4 curvas Bezier (uma por canto). Tambem zera rx/ry para
 * evitar arredondamento duplo.
 *
 * Constante k = 1 - 0.5522847498 deriva da aproximacao Bezier de um arco
 * de quadrante (formula classica para circulos via cubicas).
 */
export const applyRectCornerRadiiPatch = (rect: any): void => {
    if (!rect || !isRectObject(rect) || typeof rect._renderPaintInOrder !== 'function') return
    const radii = rect.cornerRadii
    const has = !!(radii && typeof radii === 'object')

    if (!has) {
        if ((rect as any).__origRender) {
            rect._render = (rect as any).__origRender
            delete (rect as any).__origRender
            rect.dirty = true
        }
        return
    }

    if (!(rect as any).__origRender) (rect as any).__origRender = rect._render

    rect._render = function (ctx: CanvasRenderingContext2D) {
        const w = this.width
        const h = this.height
        const x = -w / 2
        const y = -h / 2
        const k = BEZIER_ARC_K
        const r = clampCornerRadii(this.cornerRadii, w, h)

        ctx.beginPath()
        ctx.moveTo(x + r.tl, y)
        ctx.lineTo(x + w - r.tr, y)
        r.tr && ctx.bezierCurveTo(x + w - k * r.tr, y, x + w, y + k * r.tr, x + w, y + r.tr)
        ctx.lineTo(x + w, y + h - r.br)
        r.br && ctx.bezierCurveTo(x + w, y + h - k * r.br, x + w - k * r.br, y + h, x + w - r.br, y + h)
        ctx.lineTo(x + r.bl, y + h)
        r.bl && ctx.bezierCurveTo(x + k * r.bl, y + h, x, y + h - k * r.bl, x, y + h - r.bl)
        ctx.lineTo(x, y + r.tl)
        r.tl && ctx.bezierCurveTo(x, y + k * r.tl, x + k * r.tl, y, x + r.tl, y)
        ctx.closePath()
        this._renderPaintInOrder(ctx)
    }
    rect.set?.({ rx: 0, ry: 0 })
    rect.dirty = true
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

/**
 * Liga/desliga stroke + strokeWidth + strokeDashArray de um objeto Fabric,
 * preservando os valores anteriores em __stroke*Backup.
 *
 * - Hide: salva stroke/strokeWidth/strokeDashArray atuais em backups e
 *   aplica rgba(0,0,0,0) / 0 / null.
 * - Show: restaura backups; se nada valido disponivel, default '#000000'
 *   com strokeWidth 1.
 *
 * Operacao mutativa; no-op silencioso se obj e null.
 */
export const toggleStroke = (obj: any, enabled: boolean): void => {
    if (!obj) return
    ;(obj as any).__strokeEnabled = !!enabled
    if (enabled) {
        const strokePrev = (obj as any).__strokeBackup
        const widthPrev = (obj as any).__strokeWidthBackup
        const dashPrev = (obj as any).__strokeDashBackup
        if (strokePrev) obj.set?.('stroke', strokePrev)
        if (widthPrev != null) obj.set?.('strokeWidth', Number(widthPrev) || 1)
        if (dashPrev != null) obj.set?.('strokeDashArray', dashPrev)
        if (!obj.stroke) obj.set?.('stroke', '#000000')
        if (!obj.strokeWidth || obj.strokeWidth <= 0) obj.set?.('strokeWidth', 1)
    } else {
        ;(obj as any).__strokeBackup = obj.stroke
        ;(obj as any).__strokeWidthBackup = obj.strokeWidth
        ;(obj as any).__strokeDashBackup = obj.strokeDashArray
        obj.set?.({ stroke: 'rgba(0,0,0,0)', strokeWidth: 0, strokeDashArray: null })
    }
}
