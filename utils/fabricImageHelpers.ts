/**
 * Helpers puros relacionados a imagens em groups Fabric.
 *
 * Operam apenas no objeto duck-typed (precisam de getObjects/getElement,
 * crop/width/height/type/name). Sem dependencia de canvas, refs reativos
 * ou estado global.
 *
 * Cobertura: tests/utils/fabricImageHelpers.test.ts
 */

/**
 * Encontra a primeira imagem dentro de uma selecao Fabric (objeto unico
 * ou activeSelection/group). Retorna a imagem + parent quando aplicavel.
 *
 *  - Se obj e' image: retorna { img: obj, parent: null }
 *  - Se obj e' group/activeSelection com imagem dentro: retorna
 *    { img, parent: obj }
 *  - Caso contrario: null
 */
export const findImageTargetInSelection = (obj: any): { img: any; parent: any | null } | null => {
    if (!obj) return null
    const t = String(obj.type || '').toLowerCase()
    if (t === 'image') return { img: obj, parent: null }
    if (t === 'group' || t === 'activeselection') {
        const list = typeof obj.getObjects === 'function' ? obj.getObjects() : []
        const img = (list || []).find((o: any) => String(o?.type || '').toLowerCase() === 'image')
        return img ? { img, parent: obj } : null
    }
    return null
}

/**
 * Busca a imagem "preferida" dentro de um group (tipicamente um card
 * de produto). Prioriza nomes conhecidos do engine (smart_image,
 * product_image, productImage) e cai para a primeira imagem qualquer.
 *
 * Retorna null se group nao for groupable ou nao contiver imagens.
 */
export const getPreferredProductImageFromGroup = (group: any): any | null => {
    if (!group || typeof group.getObjects !== 'function') return null
    const list = group.getObjects() || []
    const preferred = list.find((o: any) => {
        if (String(o?.type || '').toLowerCase() !== 'image') return false
        const n = String(o?.name || '').trim()
        return n === 'smart_image' || n === 'product_image' || n === 'productImage'
    })
    if (preferred) return preferred
    return list.find((o: any) => String(o?.type || '').toLowerCase() === 'image') || null
}

/**
 * Extrai a URL de origem de uma fabric.Image, tentando 3 caminhos:
 *  1. `img.src` direto (mais comum)
 *  2. `img.getSrc()` (Fabric API oficial)
 *  3. `img._element.src` (HTMLImageElement subjacente)
 *
 * Retorna string vazia quando nada disponivel.
 */
export const getImageSourceFromObject = (img: any): string => {
    const direct = String((img as any)?.src || '').trim()
    if (direct) return direct
    const fromGetter = typeof (img as any)?.getSrc === 'function'
        ? String((img as any).getSrc() || '').trim()
        : ''
    if (fromGetter) return fromGetter
    const fromEl = String((img as any)?._element?.src || '').trim()
    return fromEl
}

/**
 * Calcula dimensoes "uteis" de uma imagem Fabric considerando se ja
 * existe um crop aplicado:
 *  - se ha cropX/cropY > 0 (crop ativo): usa width/height correntes do
 *    objeto (que ja' refletem a area visivel pos-crop)
 *  - senao: cai para naturalWidth/naturalHeight da `getElement()` quando
 *    disponivel (HTMLImageElement subjacente), com fallback para width
 *    /height correntes
 *
 * Sempre retorna numeros >= 1 para evitar divisao por zero em downstream
 * (ex: fitProductImageIntoSlot).
 */
export const getImageTrimmedDimensions = (img: any): { width: number; height: number } => {
    const currentWidth = Math.max(1, Number(img?.width || 0) || 1)
    const currentHeight = Math.max(1, Number(img?.height || 0) || 1)
    const hasCrop = Number(img?.cropX ?? 0) > 0 || Number(img?.cropY ?? 0) > 0
    if (hasCrop) {
        return { width: currentWidth, height: currentHeight }
    }
    const naturalWidth = Math.max(1, Number(img?.getElement?.()?.naturalWidth || 0) || currentWidth)
    const naturalHeight = Math.max(1, Number(img?.getElement?.()?.naturalHeight || 0) || currentHeight)
    return { width: naturalWidth, height: naturalHeight }
}
