/**
 * Calcula nova ordem de uma lista para implementar comandos de Z-order
 * (trazer para frente, enviar para tras, etc).
 *
 * Funcao 100% pura: recebe lista + selecao + modo, retorna nova lista
 * sem mutar input. Sem dependencia de canvas/Fabric.
 *
 * Cobertura: tests/utils/arrangeOrder.test.ts
 */

export type ArrangeMode = 'bring-to-front' | 'bring-forward' | 'send-backward' | 'send-to-back'

/**
 * Calcula nova ordem para os 4 comandos classicos de Z-order:
 *
 *  - bring-to-front: move selecionados para o final da lista (topo do
 *    Z-order do Fabric — ultimo desenhado, fica por cima)
 *  - send-to-back: move selecionados para o inicio (fundo)
 *  - bring-forward: troca cada selecionado UM passo a frente (apenas
 *    se o vizinho da frente nao for tambem selecionado, evitando loops)
 *  - send-backward: simetrico — UM passo para tras
 *
 * Retorna lista nova (nunca muta o input). Para listas com 0 ou 1
 * elemento, retorna copia inalterada.
 */
export const computeArrangedOrder = (list: any[], selected: Set<any>, mode: ArrangeMode): any[] => {
    const arr = list.slice()
    if (arr.length < 2) return arr

    if (mode === 'bring-to-front') {
        const nonSel = arr.filter(o => !selected.has(o))
        const sel = arr.filter(o => selected.has(o))
        return [...nonSel, ...sel]
    }
    if (mode === 'send-to-back') {
        const nonSel = arr.filter(o => !selected.has(o))
        const sel = arr.filter(o => selected.has(o))
        return [...sel, ...nonSel]
    }
    if (mode === 'bring-forward') {
        const out = arr.slice()
        for (let i = out.length - 2; i >= 0; i--) {
            if (selected.has(out[i]) && !selected.has(out[i + 1])) {
                const tmp = out[i]
                out[i] = out[i + 1]
                out[i + 1] = tmp
            }
        }
        return out
    }
    // send-backward
    const out = arr.slice()
    for (let i = 1; i < out.length; i++) {
        if (selected.has(out[i]) && !selected.has(out[i - 1])) {
            const tmp = out[i]
            out[i] = out[i - 1]
            out[i - 1] = tmp
        }
    }
    return out
}
