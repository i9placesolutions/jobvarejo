import { describe, expect, it, vi } from 'vitest'
vi.mock('../../utils/fabricImageHelpers', () => ({ trimImageFile: vi.fn(async file => file), autoTrimFabricImage: vi.fn() }))
import { handleFileUpload } from '../../utils/editorProductImageActionsController'

describe('upload de substituição de produto', () => {
    it('mantém o alvo do modal quando o input perde o estado local e não insere imagem solta', async () => {
        const ref = (value: any) => ({ value })
        const ctx: any = {
            pendingLocalImageActionMode: ref(null), pendingImageReplaceTargetId: ref(null), pendingImageAddCardId: ref(null),
            showProductImageUploadPicker: ref(true), productImagePickerMode: ref('replace'),
            productImagePickerTargetImageId: ref('imagem-escolhida'), productImagePickerTargetCardId: ref('card'),
            productImageReplaceScope: ref('single'), uploadFile: vi.fn(async () => ({ success: true, url: '/nova.webp' })),
            replaceImageByCustomId: vi.fn(async () => true), insertAssetToCanvas: vi.fn(), notifyEditorError: vi.fn()
        }
        await handleFileUpload(ctx, { target: { files: [{ name: 'farinha.png' }], value: 'file' } })
        expect(ctx.replaceImageByCustomId).toHaveBeenCalledWith('imagem-escolhida', '/nova.webp', { scope: 'single' })
        expect(ctx.insertAssetToCanvas).not.toHaveBeenCalled()
        expect(ctx.notifyEditorError).not.toHaveBeenCalled()
    })
})
