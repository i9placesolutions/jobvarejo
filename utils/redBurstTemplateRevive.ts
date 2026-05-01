/**
 * Helpers de "revive" para template Red Burst — corrigem propriedades
 * (visible, opacity, scaleX/Y, fontSize, text, fill) em nodes JSON
 * pre-carga, garantindo que o layout sempre renderize visivelmente
 * mesmo quando o snapshot vier com fields zerados/inconsistentes.
 *
 * Sem dependencia de Fabric/canvas/refs — operam sobre objetos plain
 * (JSON pre-loadFromJSON).
 *
 * Cobertura: tests/utils/redBurstTemplateRevive.test.ts
 */

import { isTransparentLikeTemplateColor } from './colorHelpers'
import { normalizeVisibleScale } from './mathHelpers'
import { collectTemplateJsonNodesDeep } from './canvasJsonClassifiers'

export type ReviveRedBurstOpts = {
    fallbackFill?: string
    fallbackFontSize?: number
    fallbackText?: string
    forceVisible?: boolean
}

/**
 * Aplica fallback de propriedades a um node JSON do Red Burst:
 *  - visible/opacity sao normalizados (0/false → 1/true) se forceVisible
 *  - scaleX/scaleY: se invalidos/proximos de zero, usa __visibleScaleX
 *    (ou __originalScaleX) como reset
 *  - text nodes: fontSize, text e fill recebem fallback quando ausentes
 *
 * Retorna `true` se algo foi alterado (caller pode decidir re-render).
 */
export const reviveRedBurstJsonNode = (
    node: any,
    opts: ReviveRedBurstOpts = {}
): boolean => {
    if (!node || typeof node !== 'object') return false
    let changed = false
    const forceVisible = opts.forceVisible !== false

    if (forceVisible && node.visible === false) {
        node.visible = true
        changed = true
    }
    const opacity = Number(node.opacity ?? 1)
    if (!Number.isFinite(opacity) || opacity <= 0) {
        node.opacity = 1
        changed = true
    }

    const nextScaleX = normalizeVisibleScale(
        (node as any).__visibleScaleX ?? (node as any).__originalScaleX,
        node.scaleX
    )
    const nextScaleY = normalizeVisibleScale(
        (node as any).__visibleScaleY ?? (node as any).__originalScaleY,
        node.scaleY
    )
    if (!Number.isFinite(Number(node.scaleX)) || Math.abs(Number(node.scaleX || 0)) < 0.0001) {
        node.scaleX = nextScaleX
        changed = true
    }
    if (!Number.isFinite(Number(node.scaleY)) || Math.abs(Number(node.scaleY || 0)) < 0.0001) {
        node.scaleY = nextScaleY
        changed = true
    }

    const type = String(node.type || '').toLowerCase()
    const isTextNode = type === 'text' || type === 'i-text' || type === 'itext' || type === 'textbox'
    if (isTextNode) {
        const currentFont = Number(node.fontSize)
        const fallbackFont = Number(opts.fallbackFontSize ?? (node as any).__originalFontSize ?? currentFont)
        if (!Number.isFinite(currentFont) || currentFont <= 0) {
            node.fontSize = Number.isFinite(fallbackFont) && fallbackFont > 0 ? fallbackFont : 18
            changed = true
        }
        if (typeof opts.fallbackText === 'string' && !String(node.text || '').trim()) {
            node.text = opts.fallbackText
            changed = true
        }
        if (typeof opts.fallbackFill === 'string' && isTransparentLikeTemplateColor(node.fill)) {
            node.fill = opts.fallbackFill
            changed = true
        }
    }

    return changed
}

/**
 * Sanitiza um groupJson do template Red Burst — busca nodes-chave
 * (price_bg, price_header_bg, price_header_text, price_burst_line_a,
 * price_currency_text, price_integer_text, price_decimal_text) e aplica
 * `reviveRedBurstJsonNode` em cada um com fallbacks especificos.
 *
 * Mutates o input em place (consistente com o pipeline de pre-load).
 * Retorna o proprio groupJson para chaining.
 *
 * Se algum dos nodes obrigatorios nao for encontrado, retorna sem
 * alterar (groupJson nao parece ser Red Burst).
 */
export const sanitizeRedBurstTemplateGroupJson = (groupJson: any): any => {
    if (!groupJson || typeof groupJson !== 'object') return groupJson
    const nodes = collectTemplateJsonNodesDeep(groupJson)
    const byName = (name: string) => nodes.find((node: any) => String(node?.name || '') === name)
    const priceBg = byName('price_bg')
    const headerBg = byName('price_header_bg')
    const headerText = byName('price_header_text')
    const burst = byName('price_burst_line_a')
    const currencyText = byName('price_currency_text')
    const priceInteger = byName('price_integer_text')
    const priceDecimal = byName('price_decimal_text')
    if (!(priceBg && headerBg && headerText && burst && priceInteger && priceDecimal)) return groupJson

    const ensureShellVisible = (node: any) => {
        if (!node || typeof node !== 'object') return
        const opacity = Number(node.opacity ?? 1)
        if (node.visible === false) node.visible = true
        if (!Number.isFinite(opacity) || opacity <= 0) node.opacity = 1
    }

    ensureShellVisible(priceBg)
    ensureShellVisible(headerBg)
    reviveRedBurstJsonNode(headerText, {
        fallbackFill: '#ffd94c',
        fallbackFontSize: 28,
        fallbackText: 'OFERTA'
    })
    reviveRedBurstJsonNode(currencyText, {
        fallbackFill: '#ffffff',
        fallbackFontSize: 30,
        fallbackText: 'R$'
    })
    reviveRedBurstJsonNode(priceInteger, {
        fallbackFill: '#ffffff',
        fallbackFontSize: 92,
        fallbackText: '0'
    })
    reviveRedBurstJsonNode(priceDecimal, {
        fallbackFill: '#ffffff',
        fallbackFontSize: 44,
        fallbackText: ',00'
    })
    return groupJson
}
