/**
 * Validacoes de objetos Fabric / canvas em runtime.
 *
 * Funcoes 100% puras que checam estrutura/integridade — usadas em:
 *  - error handling (isCanvasContextError)
 *  - sanitizacao do canvas (isValidFabricCanvasObject)
 *  - sanitizacao de clipPaths corrompidos por (de)serializacao (isValidClipPath)
 *
 * Cobertura: tests/utils/canvasValidation.test.ts
 */

/**
 * Detecta erros tipicos do Canvas2D context (clearRect, contextContainer,
 * getContext) — usado em catch handlers para distinguir falhas de
 * pintura de outras exceções.
 */
export const isCanvasContextError = (err: any): boolean => {
    const msg = String(err?.message || err || '').toLowerCase()
    return msg.includes('clearrect') || msg.includes('contextcontainer') || msg.includes('getcontext')
}

/**
 * Valida que um objeto e' um Fabric.Object real, com a API basica
 * que o canvas espera (render, setCoords, set, toObject).
 *
 * Util para filtrar entradas corrompidas do canvas.getObjects() apos
 * desserializacao parcial ou falha.
 */
export const isValidFabricCanvasObject = (o: any): boolean => {
    if (!o || typeof o !== 'object') return false
    return (
        typeof o.render === 'function' &&
        typeof o.setCoords === 'function' &&
        typeof o.set === 'function' &&
        typeof o.toObject === 'function'
    )
}

/**
 * Valida estrutura de um clipPath.
 *
 * Critica porque clipPaths corrompidos disparam:
 *  - "forEach of undefined" em createClipPathLayer (Fabric)
 *  - perda silenciosa de mascara em groups
 *  - loops infinitos em clipPaths recursivos
 *
 * Verifica:
 *  1. e' objeto (nao array, nao primitivo)
 *  2. tem .type
 *  3. _objects e' array (se definido) — em group/activeSelection NUNCA
 *     pode ser undefined
 *  4. tem .render funcao
 *  5. clipPath aninhado tambem valido (recursivo)
 *  6. children com _objects validos (nao undefined em group-like)
 */
export const isValidClipPath = (clipPath: any): boolean => {
    if (!clipPath) return false

    if (typeof clipPath !== 'object' || Array.isArray(clipPath)) return false

    if (!clipPath.type) return false

    if (clipPath._objects !== undefined && !Array.isArray(clipPath._objects)) {
        return false
    }

    if (clipPath._objects === undefined &&
        (clipPath.type === 'group' || clipPath.type === 'activeSelection')) {
        return false
    }

    if (typeof clipPath.render !== 'function') return false

    if (clipPath.clipPath && !isValidClipPath(clipPath.clipPath)) {
        return false
    }

    if (Array.isArray(clipPath._objects)) {
        for (const child of clipPath._objects) {
            if (child && child._objects !== undefined && !Array.isArray(child._objects)) {
                return false
            }
            if (child && child.clipPath && !isValidClipPath(child.clipPath)) {
                return false
            }
        }
    }

    return true
}
