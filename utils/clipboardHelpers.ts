/**
 * Helpers puros para clipboard do editor.
 *
 * Sao normalizadores leves — sem dependencia de canvas, refs reativos
 * ou DOM real.
 *
 * Cobertura: tests/utils/clipboardHelpers.test.ts
 */

import { CANVAS_CUSTOM_PROPS } from './canvasCustomProps'

/**
 * Storage key usado para persistir o clipboard no localStorage para
 * paste cross-tab. Versao 2 (v1 nao tinha selectionCenter).
 */
export const CROSS_TAB_CLIPBOARD_STORAGE_KEY = 'jobvarejo:editor:fabric-clipboard:v2'

/**
 * Idade maxima de um payload no localStorage (24h). Apos isso
 * descartamos — provavelmente outra aba/sessao deixou cache stale.
 */
export const CROSS_TAB_CLIPBOARD_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Limite de bytes para o payload serializado. localStorage geralmente
 * tem 5-10MB total — 2MB e' um teto seguro que nao explode quota
 * mesmo com clipboard grande.
 */
export const CROSS_TAB_CLIPBOARD_MAX_BYTES = 2_000_000

/**
 * Props essenciais para clonar objetos Fabric via clipboard. Inclui
 * tudo de CANVAS_CUSTOM_PROPS + transforms basicos (opacity, scaleX/Y,
 * flipX/Y, originX/Y, angle, skewX/Y) que nao estao no array principal.
 *
 * Caller usa em fabric.Object.toObject(props) ou clone().
 */
export const CLIPBOARD_CLONE_PROPS: ReadonlyArray<string> = Array.from(new Set([
    ...CANVAS_CUSTOM_PROPS,
    'opacity',
    'flipX',
    'flipY',
    'clipPath',
    'filters',
    'originX',
    'originY',
    'angle',
    'scaleX',
    'scaleY',
    'skewX',
    'skewY'
]))

/**
 * Props serializadas para clipboard cross-tab. Inclui CLIPBOARD_CLONE_PROPS
 * + metadata de origem (sourceCustomId, sourceLeft, sourceTop) necessaria
 * para o paste detectar duplicatas e posicionar o clone corretamente.
 */
export const CLIPBOARD_SERIALIZE_PROPS: ReadonlyArray<string> = Array.from(new Set([
    ...CLIPBOARD_CLONE_PROPS,
    '_clipboardCenterX',
    '_clipboardCenterY',
    '_clipboardSourceCustomId',
    '_sourceGroupId',
    '_sourceLeft',
    '_sourceTop'
]))

/**
 * Normaliza um ponto de clipboard para `{ x, y }` numericos finitos.
 * Defaults para 0 quando algum campo nao for parseavel.
 *
 * Util para garantir que paste-coordinates vindas de window.event ou
 * touch events nunca contenham NaN/Infinity ou undefined.
 */
export const normalizeClipboardPoint = (point: any): { x: number; y: number } => {
    const x = Number(point?.x)
    const y = Number(point?.y)
    return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0
    }
}

/**
 * Serializa um runtime clipboard para JSON string que pode ser
 * persistido em localStorage e lido em outra aba do navegador.
 *
 * Caller deve passar `serializeProps` (tipicamente CLIPBOARD_SERIALIZE_PROPS)
 * para `item.toObject(serializeProps)`.
 *
 * Aborta se:
 *  - runtimeClipboard nao tem kind 'fabric-items-v2' ou items array
 *  - todos os items falham toObject
 *  - JSON resultante excede CROSS_TAB_CLIPBOARD_MAX_BYTES
 *
 * Retorna o JSON string ou null.
 */
export const serializeRuntimeClipboardForCrossTab = (
    runtimeClipboard: any,
    serializeProps: ReadonlyArray<string>
): string | null => {
    if (!runtimeClipboard || runtimeClipboard.kind !== 'fabric-items-v2' || !Array.isArray(runtimeClipboard.items)) return null

    const itemsJson: any[] = []
    for (const item of runtimeClipboard.items) {
        if (!item || typeof item.toObject !== 'function') continue
        try {
            const itemJson = item.toObject(serializeProps)
            if (itemJson && typeof itemJson === 'object') {
                itemsJson.push(itemJson)
            }
        } catch (err) {
            console.warn('[clipboard] Falha ao serializar item para cross-tab', err)
        }
    }

    if (!itemsJson.length) return null

    const payload = {
        format: 'jobvarejo-fabric-items-v2',
        version: 1,
        copiedAt: Number(runtimeClipboard.copiedAt || Date.now()) || Date.now(),
        sourcePageId: String(runtimeClipboard.sourcePageId || '').trim(),
        selectionCenter: normalizeClipboardPoint(runtimeClipboard.selectionCenter),
        itemsJson
    }

    try {
        const raw = JSON.stringify(payload)
        if (!raw || raw.length > CROSS_TAB_CLIPBOARD_MAX_BYTES) return null
        return raw
    } catch (err) {
        console.warn('[clipboard] Falha ao codificar payload cross-tab', err)
        return null
    }
}

/**
 * Parse defensivo de um payload cross-tab clipboard armazenado em
 * localStorage (string ou null). Aceita o payload se:
 *  - format === 'jobvarejo-fabric-items-v2'
 *  - itemsJson e' array nao-vazio
 *  - copiedAt e' numero finito > 0
 *  - idade < CROSS_TAB_CLIPBOARD_MAX_AGE_MS
 *
 * Retorna o payload parseado, ou null em qualquer caso de invalido/expirado.
 *
 * Caller decide se quer remover entrada expirada do storage (esta funcao
 * nao toca em localStorage).
 */
export const parseCrossTabClipboardPayload = (raw: string | null | undefined): any | null => {
    if (!raw) return null
    try {
        const payload = JSON.parse(raw)
        if (!payload || payload.format !== 'jobvarejo-fabric-items-v2' || !Array.isArray(payload.itemsJson)) return null
        const copiedAt = Number(payload.copiedAt || 0)
        if (!Number.isFinite(copiedAt) || copiedAt <= 0) return null
        if ((Date.now() - copiedAt) > CROSS_TAB_CLIPBOARD_MAX_AGE_MS) return null
        if (!payload.itemsJson.length) return null
        return payload
    } catch {
        return null
    }
}
