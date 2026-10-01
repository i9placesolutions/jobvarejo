/** A logo é um dado da loja, nunca um selo decorativo do modelo. */
export const isQuickLogoImage = (object: any): boolean => (
    String(object?.type || '').trim().toLowerCase() === 'image' && (
        object?.quickLogoSlot === true ||
        String(object?.businessProfileField || object?.quickDataField || '').trim().toLowerCase() === 'logo'
    )
)

type QuickModeFrameBounds = { left: number; top: number; width: number; height: number }

const normalizedSemanticLabel = (value: unknown): string => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const hasHeaderFooterLabel = (object: any): boolean => {
    const values = [object?.name, object?.layerName, object?.label, object?.quickSection]
    return values.some(value => /(?:^|[\s_\-–—])(header|footer|cabecalho|rodape)(?:$|[\s_\-–—])/i.test(normalizedSemanticLabel(value)))
}

const isPlacedInHeaderOrFooter = (object: any, frameBounds?: QuickModeFrameBounds | null): boolean => {
    if (!frameBounds || !Number.isFinite(frameBounds.height) || frameBounds.height <= 0) return false
    let bounds: any = null
    try { bounds = object?.getBoundingRect?.(true) } catch { /* use stored geometry */ }
    const width = Math.abs(Number(bounds?.width ?? (Number(object?.width || 0) * Number(object?.scaleX || 1))))
    const height = Math.abs(Number(bounds?.height ?? (Number(object?.height || 0) * Number(object?.scaleY || 1))))
    const top = Number(bounds?.top ?? object?.top ?? 0)
    if (![width, height, top].every(Number.isFinite) || height <= 0) return false

    const centerRatio = (top + height / 2 - frameBounds.top) / frameBounds.height
    // Position fallback is only for objects concentrated in the header/footer.
    // A full-page photo/background stays fixed even though it overlaps both areas.
    if (height / frameBounds.height > 0.58) return false
    return centerRatio <= 0.42 || centerRatio >= 0.80
}

const coversMostOfPage = (object: any, frameBounds?: QuickModeFrameBounds | null): boolean => {
    if (!frameBounds || frameBounds.width <= 0 || frameBounds.height <= 0) return false
    let bounds: any = null
    try { bounds = object?.getBoundingRect?.(true) } catch { /* use stored geometry */ }
    const width = Math.abs(Number(bounds?.width ?? (Number(object?.width || 0) * Number(object?.scaleX || 1))))
    const height = Math.abs(Number(bounds?.height ?? (Number(object?.height || 0) * Number(object?.scaleY || 1))))
    return width / frameBounds.width >= 0.75 && height / frameBounds.height >= 0.75
}

const hasHeaderFooterOwner = (object: any): boolean => {
    const visited = new Set<any>()
    let owner = object
    while (owner && !visited.has(owner)) {
        visited.add(owner)
        if (hasHeaderFooterLabel(owner)) return true
        owner = owner.parent || owner.group
    }
    return false
}

/** Lista explícita do que o cliente pode mover na edição rápida. */
export const canMoveQuickModeObject = (object: any, frameBounds?: QuickModeFrameBounds | null): boolean => {
    if (!object) return false
    // A estrutura da página/zona e a placa da logo nunca se movem sozinhas.
    if (object.isFrame || object.isProductZone || object.isGridZone || object.quickLogoBackdrop || object.id === 'artboard-bg') return false
    if (isQuickLogoImage(object) || object.quickLogoSlot === true) return true
    // Uploads do usuário precisam continuar selecionáveis para remover/corrigir.
    if (object.data?.quickEditableUpload === true) return true
    if (coversMostOfPage(object, frameBounds)) return false
    const type = String(object.type || '').toLowerCase()
    if (['text', 'i-text', 'textbox'].includes(type) &&
        String(object.businessProfileField || object.quickDataField || '').trim()) return true

    const visited = new Set<any>()
    let owner = object
    while (owner && !visited.has(owner)) {
        visited.add(owner)
        if (owner.parentZoneId || owner.isProductCard || owner._productData ||
            String(owner.name || '').startsWith('product-card')) return true
        // O conteúdo de uma zona é editável; a zona em si foi excluída acima.
        if (owner !== object && (owner.isProductZone || owner.isGridZone)) return true
        // Fabric moves selected children into an ActiveSelection for rendering,
        // but `parent` still points to the card that owns them. Using `group`
        // first incorrectly locks these children and clears the new selection.
        owner = owner.parent || owner.group
    }
    if (hasHeaderFooterOwner(object) || isPlacedInHeaderOrFooter(object, frameBounds)) return true
    return false
}

/** Identifica artwork fixa fora do cabeçalho/rodapé e do conteúdo de produto. */
export const isQuickModeFixedArtwork = (object: any, frameBounds?: QuickModeFrameBounds | null): boolean =>
    !!object && !canMoveQuickModeObject(object, frameBounds)
