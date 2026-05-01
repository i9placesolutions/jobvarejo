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
