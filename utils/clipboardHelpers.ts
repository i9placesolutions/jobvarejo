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
 * Chave usada por versões anteriores para persistir um clone Fabric no
 * localStorage. Ela é removida na inicialização do editor para que uma cópia
 * antiga nunca volte a disputar prioridade com o clipboard atual do sistema.
 */
export const LEGACY_CROSS_TAB_CLIPBOARD_STORAGE_KEY = 'jobvarejo:editor:fabric-clipboard:v2'

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

export type EditorPasteSource = 'system' | 'editor'

/**
 * Ctrl/Cmd+V é sempre uma colagem do sistema. O clone Fabric só pode ser
 * usado quando uma ação explícita da interface pede para colar uma cópia do
 * editor; assim uma cópia antiga nunca substitui o conteúdo recém-copiado.
 */
export const resolveEditorPasteSource = (explicitEditorPaste = false): EditorPasteSource =>
    explicitEditorPaste ? 'editor' : 'system'
