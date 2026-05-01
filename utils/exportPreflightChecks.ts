/**
 * Preflight checks puros para exportacao do canvas. Detecta problemas
 * comerciais antes de gerar PNG/JPG (imagens quebradas, zonas vazias,
 * cards sem dados).
 *
 * Sem dependencia de canvas/refs. Recebe array de objects + predicate
 * isLikelyProductZone via injection.
 *
 * Cobertura: tests/utils/exportPreflightChecks.test.ts
 */

export type ExportPreflightInput = {
    objects: any[]
    isLikelyProductZone: (obj: any) => boolean
}

/**
 * Detalhes do resultado: contadores brutos para o caller decidir
 * se warna ou bloqueia.
 */
export type ExportPreflightCounts = {
    brokenImages: number
    emptyProductCards: number
    emptyZones: number
}

/**
 * Varre todos os objetos do canvas (recursivamente em groups) e conta:
 *  - imagens quebradas (sem src ou _element.naturalWidth=0/__loadFailed)
 *  - cards de produto vazios (sem productName e sem productPrice)
 *  - zonas vazias (sem cards com parentZoneId apontando pra ela)
 *
 * Pure: nao acessa canvas/refs.
 */
export const computeExportPreflightCounts = (input: ExportPreflightInput): ExportPreflightCounts => {
    const objects = Array.isArray(input?.objects) ? input.objects : []
    const isLikelyProductZone = typeof input?.isLikelyProductZone === 'function'
        ? input.isLikelyProductZone
        : () => false

    let brokenImages = 0
    let emptyProductCards = 0
    let emptyZones = 0

    const walk = (list: any[]): void => {
        for (const obj of list || []) {
            if (!obj) continue
            const t = String(obj.type || '').toLowerCase()
            if (t === 'image') {
                const hasSrc = !!(obj._element?.src || obj.src)
                const failed = obj._element?.naturalWidth === 0 || (obj as any).__loadFailed === true
                if (!hasSrc || failed) brokenImages++
            }
            if (isLikelyProductZone(obj)) {
                const zoneId = String((obj as any)._customId || '').trim()
                const cards = objects.filter((o: any) =>
                    String((o as any).parentZoneId || '').trim() === zoneId
                )
                if (cards.length === 0) emptyZones++
            }
            if ((obj as any).isProductCard) {
                const name = String((obj as any).productName || '').trim()
                const price = String((obj as any).productPrice || '').trim()
                if (!name && !price) emptyProductCards++
            }
            if (typeof obj.getObjects === 'function') {
                walk(obj.getObjects() || [])
            }
        }
    }

    try {
        walk(objects)
    } catch {
        // Best-effort. Caller pode complementar com checks adicionais.
    }

    return { brokenImages, emptyProductCards, emptyZones }
}

/**
 * Constroi mensagens de warning a partir dos counts. Retorna array
 * de strings (vazio se nao ha problemas). Pure.
 */
export const buildExportPreflightWarnings = (counts: ExportPreflightCounts): string[] => {
    const warnings: string[] = []
    if (counts.brokenImages > 0) {
        warnings.push(`${counts.brokenImages} imagem(ns) nao carregaram — elas aparecerao em branco no export.`)
    }
    if (counts.emptyZones > 0) {
        warnings.push(`${counts.emptyZones} zona(s) de produto sem cards — o layout pode ficar vazio.`)
    }
    if (counts.emptyProductCards > 0) {
        warnings.push(`${counts.emptyProductCards} card(s) de produto sem nome/preco — informacoes comerciais podem estar incompletas.`)
    }
    return warnings
}
