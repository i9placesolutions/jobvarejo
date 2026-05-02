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
 * Detecta erros de autenticacao/autorizacao em respostas HTTP/fetch.
 * Aceita codigo 401/403 ou mensagem contendo termos de sessao expirada.
 *
 * Usado para distinguir "preciso reautenticar" de outros erros transitorios
 * em fluxos de busca de imagem por produto.
 */
export const isAuthLookupError = (err: any): boolean => {
    const code = Number(err?.statusCode || err?.status || err?.response?.status || 0)
    if (code === 401 || code === 403) return true
    const msg = String(err?.message || err || '').toLowerCase()
    if (!msg) return false
    return msg.includes('sessão expirada') ||
        msg.includes('session') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden')
}

/**
 * Versao "leve" para detectar se um objeto resultante de clone/enliven
 * pode ser USADO (set + setCoords disponiveis). Diferente do mais
 * estrito isValidFabricCanvasObject que tambem exige render/toObject.
 *
 * Usado em fluxos de duplicate/clone onde queremos saber se vale
 * tentar manipular o resultado antes de descartar.
 */
export const isUsableFabricObjectClone = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false
    return typeof obj.set === 'function' && typeof obj.setCoords === 'function'
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

/**
 * Limpa todos os objetos de uma instancia de canvas com fallback robusto:
 *  1. discardActiveObject() + clear() (caminho rapido)
 *  2. Em caso de erro: remove cada objeto individualmente em ordem inversa
 *
 * Usado durante page switches onde clear() pode falhar com objetos em
 * estado inconsistente (resultado de bug em outras partes do pipeline).
 *
 * Mutates a canvas instance. Sem retorno — best-effort.
 */
export const clearCanvasForPageSwitch = (canvasInstance: any): void => {
    if (!canvasInstance) return
    try {
        canvasInstance.discardActiveObject?.()
        canvasInstance.clear()
        return
    } catch (err) {
        console.warn('⚠️ clear() falhou no page switch, tentando remoção manual:', err)
    }

    try {
        const allObjects = Array.isArray(canvasInstance.getObjects?.()) ? [...canvasInstance.getObjects()] : []
        for (let i = allObjects.length - 1; i >= 0; i--) {
            try {
                canvasInstance.remove(allObjects[i])
            } catch {
                // ignore object-specific remove failures
            }
        }
        canvasInstance.requestRenderAll?.()
    } catch (manualErr) {
        console.error('❌ Falha ao limpar canvas no page switch:', manualErr)
    }
}

/**
 * Walk recursivo em todos os objetos de uma canvas instance procurando
 * por `_customId === id`. Desce em groups e activeselections.
 *
 * Retorna `{ obj, parent }` onde `parent` e o group que contem o obj
 * encontrado (ou null se for top-level no canvas).
 *
 * Caller passa `canvasInstance` (com getObjects()).
 */
export const findObjectByCustomId = (
    canvasInstance: any,
    id: string
): { obj: any; parent: any | null } | null => {
    if (!canvasInstance || !id) return null
    const walk = (node: any, parent: any | null): { obj: any; parent: any | null } | null => {
        if (!node) return null
        if ((node as any)._customId === id) return { obj: node, parent }
        const t = String(node.type || '').toLowerCase()
        if (t === 'group' || t === 'activeselection') {
            const list = typeof node.getObjects === 'function' ? node.getObjects() : []
            for (const child of (list || [])) {
                const found = walk(child, node)
                if (found) return found
            }
        }
        return null
    }
    for (const top of canvasInstance.getObjects()) {
        const found = walk(top, null)
        if (found) return found
    }
    return null
}

/**
 * Walk recursivo procurando por um product card pelo `_customId`.
 * Retorna o card encontrado ou seu parent (se o id pertencer a um
 * filho). Null se nao encontrar.
 *
 * Caller injeta:
 *  - canvasInstance (para `findObjectByCustomId`)
 *  - `isCardContainerCheck` (isProductCardContainer)
 *  - `isLikelyCardCheck` (isLikelyProductCard)
 */
export const findProductCardByCustomId = (
    canvasInstance: any,
    id: string,
    isCardContainerCheck: (obj: any) => boolean,
    isLikelyCardCheck: (obj: any) => boolean
): any | null => {
    const found = findObjectByCustomId(canvasInstance, id)
    if (!found) return null
    if (isCardContainerCheck(found.obj) || isLikelyCardCheck(found.obj)) return found.obj
    if (found.parent && (isCardContainerCheck(found.parent) || isLikelyCardCheck(found.parent))) return found.parent
    return null
}
