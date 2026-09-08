import { describe, expect, it } from 'vitest'
import {
    resolveTemplateCompositionFrameBinding,
    shouldPreserveTemplateFrameClip
} from '../../utils/templateFrameClipping'

const templateFrame = {
    _customId: 'frame-modelo',
    isFrame: true,
    clipContent: true,
    templateCompositionManaged: true,
    quickSeedId: 'mes-do-consumidor'
}

describe('recorte de Frames de modelos', () => {
    it('mantém o recorte ativo para o Frame de uma composição editável', () => {
        expect(shouldPreserveTemplateFrameClip(templateFrame)).toBe(true)
        expect(shouldPreserveTemplateFrameClip({ ...templateFrame, clipContent: false })).toBe(false)
    })

    it('recupera o elemento decorativo salvo sem parentFrameId pelo seed do modelo', () => {
        expect(resolveTemplateCompositionFrameBinding({
            templateCompositionManaged: true,
            quickSeedId: 'mes-do-consumidor'
        }, [templateFrame])).toBe('frame-modelo')
    })

    it('não prende cards de produto nem escolhe um Frame ambíguo', () => {
        expect(resolveTemplateCompositionFrameBinding({
            templateCompositionManaged: true,
            quickSeedId: 'mes-do-consumidor',
            isProductCard: true
        }, [templateFrame])).toBeNull()

        expect(resolveTemplateCompositionFrameBinding({
            templateCompositionManaged: true,
            quickSeedId: 'mes-do-consumidor'
        }, [templateFrame, { ...templateFrame, _customId: 'outro-frame-modelo' }])).toBeNull()
    })
})
