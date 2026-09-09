/** A logo é um dado da loja, nunca um selo decorativo do modelo. */
export const isQuickLogoImage = (object: any): boolean => (
    String(object?.type || '').trim().toLowerCase() === 'image' && (
        object?.quickLogoSlot === true ||
        String(object?.businessProfileField || object?.quickDataField || '').trim().toLowerCase() === 'logo'
    )
)

/** Lista explícita do que o cliente pode mover na edição rápida. */
export const canMoveQuickModeObject = (object: any): boolean => {
    if (!object) return false
    // A estrutura da página/zona e a placa da logo nunca se movem sozinhas.
    if (object.isFrame || object.isProductZone || object.isGridZone || object.quickLogoBackdrop) return false
    if (isQuickLogoImage(object) || object.quickLogoSlot === true) return true
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
        owner = owner.group || owner.parent
    }
    return false
}

/** Bloqueia também formas, ícones, textos estáticos e grupos decorativos. */
export const isQuickModeFixedArtwork = (object: any): boolean =>
    !!object && !canMoveQuickModeObject(object)
