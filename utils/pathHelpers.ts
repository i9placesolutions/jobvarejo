/**
 * Helpers puros de manipulacao de SVG path data usados pelo pen tool.
 *
 * Sem dependencia de Fabric, canvas ou DOM. Operam em estruturas plain
 * (arrays/objects com pontos x/y e handles in/out).
 *
 * Cobertura: tests/utils/pathHelpers.test.ts
 */

/**
 * Tipo de um ponto-pen com handles opcionais para curvas Bezier.
 */
export type PenPoint = {
    x: number
    y: number
    handles?: {
        in?: { x: number; y: number }
        out?: { x: number; y: number }
    }
}

/**
 * Constroi uma string SVG path a partir de pontos do pen tool.
 *
 * Regras:
 *  - Primeiro ponto: M x y
 *  - Pontos seguintes:
 *    - Se ha handles.in no ponto atual e/ou handles.out no anterior:
 *      C cp1x cp1y, cp2x cp2y, x y (curva Bezier cubica)
 *    - Senao: L x y (linha reta)
 *  - `closed=true` adiciona Z no final (so se ha 3+ pontos)
 *  - Array vazio/invalido: retorna '' (string vazia)
 *
 * Os handles ausentes sao substituidos pelo proprio ponto (handle de
 * comprimento zero), o que produz uma curva visualmente equivalente a
 * uma linha mas mantem a forma do path como cubica para edicao posterior.
 */
export const buildPathStringFromPenData = (pathData: PenPoint[] | any[], closed = false): string => {
    if (!Array.isArray(pathData) || pathData.length === 0) return ''
    let pathString = ''
    pathData.forEach((point: any, index: number) => {
        if (index === 0) {
            pathString += `M ${point.x} ${point.y}`
        } else {
            const prevPoint = pathData[index - 1]
            if (prevPoint && point?.handles?.in) {
                const cp1x = prevPoint?.handles?.out?.x ?? prevPoint.x
                const cp1y = prevPoint?.handles?.out?.y ?? prevPoint.y
                const cp2x = point.handles.in.x
                const cp2y = point.handles.in.y
                pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`
            } else {
                pathString += ` L ${point.x} ${point.y}`
            }
        }
    })
    if (closed && pathData.length > 2) pathString += ' Z'
    return pathString
}
