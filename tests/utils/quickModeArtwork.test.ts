import { describe, expect, it } from 'vitest'
import { isQuickLogoImage, isQuickModeFixedArtwork } from '../../utils/quickModeArtwork'

describe('logo e elementos fixos na edição rápida', () => {
    it.each([
        { type: 'Image', businessProfileField: 'logo' },
        { type: 'image', quickDataField: 'logo' },
        { type: 'image', quickLogoSlot: true }
    ])('reconhece a logo atual/legada e libera suas opções: %j', object => {
        expect(isQuickLogoImage(object)).toBe(true)
        expect(isQuickModeFixedArtwork(object)).toBe(false)
    })
    it('bloqueia selo e fundo sem depender do nome do upload', () => {
        expect(isQuickModeFixedArtwork({ type: 'Image', name: 'arquivo-123' })).toBe(true)
        expect(isQuickModeFixedArtwork({ type: 'group', layerName: 'Selo 3D' })).toBe(true)
        expect(isQuickModeFixedArtwork({ type: 'group', name: 'mes-do-consumidor-selo-3d' })).toBe(true)
    })
    it('preserva imagens e selos que fazem parte dos cards de produtos, inclusive aninhados', () => {
        const card = { isProductCard: true }
        const inner = { group: card }
        expect(isQuickModeFixedArtwork({ type: 'image', group: inner })).toBe(false)
        expect(isQuickModeFixedArtwork({ type: 'image', parentZoneId: 'zone-1' })).toBe(false)
        expect(isQuickModeFixedArtwork({ type: 'group', name: 'selo-oferta', group: card })).toBe(false)
    })
    it('não confunde fundo vinculado, reserva de logo e texto comercial com selo', () => {
        expect(isQuickModeFixedArtwork({ type: 'rect', quickLogoSlot: true })).toBe(false)
        expect(isQuickModeFixedArtwork({ type: 'rect', quickLogoBackdrop: true })).toBe(true)
        expect(isQuickModeFixedArtwork({ type: 'textbox', businessProfileField: 'name' })).toBe(false)
    })
})


describe('restrição de movimento no editor rápido', () => {
    it('mantém imagens editáveis enquanto o Fabric as coloca na seleção múltipla', () => {
        const card = { type: 'group', isProductCard: true, parentZoneId: 'zone-1' }
        const selection = { type: 'activeselection' }
        const image = { type: 'image', parent: card, group: selection }
        expect(isQuickModeFixedArtwork(image)).toBe(false)
        image.group = card
        expect(isQuickModeFixedArtwork(image)).toBe(false)
        expect(isQuickModeFixedArtwork({ type: 'image', group: selection })).toBe(true)
    })
    it.each(['image', 'rect', 'path', 'group', 'textbox'])('bloqueia %s sem vínculo editável', type => {
        expect(isQuickModeFixedArtwork({ type, name: 'elemento-do-modelo' })).toBe(true)
    })
    it.each(['address', 'instagram', 'whatsapp', 'validity'])('libera texto dinâmico %s mesmo em grupo fixo', field => {
        const group = { type: 'group', name: 'rodape' }
        expect(isQuickModeFixedArtwork({ type: 'textbox', quickDataField: field, group })).toBe(false)
    })
    it('libera conteúdo da zona mas mantém a zona e o frame fixos', () => {
        const zone = { type: 'group', isProductZone: true }
        expect(isQuickModeFixedArtwork(zone)).toBe(true)
        expect(isQuickModeFixedArtwork({ type: 'image', group: zone })).toBe(false)
        expect(isQuickModeFixedArtwork({ type: 'textbox', group: zone })).toBe(false)
        expect(isQuickModeFixedArtwork({ type: 'rect', isFrame: true })).toBe(true)
    })
})
