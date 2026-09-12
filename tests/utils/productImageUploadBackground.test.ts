import { expect, it, vi } from 'vitest'
vi.mock('../../utils/fabricImageHelpers', () => ({ trimImageFile: async (file: any) => file, autoTrimFabricImage: vi.fn() }))
import { handleFileUpload } from '../../utils/editorProductImageActionsController'
const fixture = (mode: string | null) => ({
 pendingLocalImageActionMode: {value:mode}, pendingImageReplaceTargetId:{value:'image'}, pendingImageAddCardId:{value:'card'},
 productImagePickerTargetImageId:{value:null}, productImagePickerTargetCardId:{value:null},
 uploadFile:vi.fn().mockResolvedValue({success:true,url:'processed.webp'}), replaceImageByCustomId:vi.fn().mockResolvedValue(true),
 findProductCardByCustomId:()=>({}), addImageToProductCardByUrl:vi.fn().mockResolvedValue(true), notifyEditorError:vi.fn(),
 getCenterOfView:()=>({x:0,y:0}), makeCanvasObjectId:()=> 'id', insertAssetToCanvas:vi.fn()
})
it.each(['replace','add'])('remove fundo antes de %s no card', async mode => {
 const ctx=fixture(mode), file={name:'vinho.jpg'}
 await handleFileUpload(ctx as any,{target:{files:[file],value:''}})
 expect(ctx.uploadFile).toHaveBeenCalledWith(file,{removeBackground:true})
 expect(mode==='replace'?ctx.replaceImageByCustomId:ctx.addImageToProductCardByUrl).toHaveBeenCalled()
})
it('mantém a imagem anterior quando o processamento falha', async()=>{
 const ctx=fixture('replace');ctx.uploadFile.mockRejectedValue(new Error('BiRefNet indisponível'))
 await handleFileUpload(ctx as any,{target:{files:[{name:'vinho.jpg'}],value:''}})
 expect(ctx.replaceImageByCustomId).not.toHaveBeenCalled();expect(ctx.notifyEditorError).toHaveBeenCalled()
})
it('preserva upload comum de arte sem remoção obrigatória', async()=>{
 const ctx=fixture(null),file={name:'tema.jpg'}
 await handleFileUpload(ctx as any,{target:{files:[file],value:''}})
 expect(ctx.uploadFile).toHaveBeenCalledWith(file)
})

it('processa a imagem escolhida da biblioteca antes de aplicá-la',async()=>{
 const { applyProductImageFromUploadPicker }=await import('../../utils/editorProductImageActionsController')
 const ctx={...fixture('replace'),productImagePickerMode:{value:'replace'},productImagePickerTargetImageId:{value:'image'},showProductImageUploadPicker:{value:true},prepareProductImageUrl:vi.fn().mockResolvedValue('sem-fundo.png')}
 await applyProductImageFromUploadPicker(ctx as any,{url:'com-fundo.jpg'})
 expect(ctx.prepareProductImageUrl).toHaveBeenCalledWith('com-fundo.jpg')
 expect(ctx.replaceImageByCustomId).toHaveBeenCalledWith('image','sem-fundo.png',{scope:'single'})
})
it('mantém a imagem do card se a remoção da imagem da biblioteca falhar',async()=>{
 const { applyProductImageFromUploadPicker }=await import('../../utils/editorProductImageActionsController')
 const ctx={...fixture('replace'),productImagePickerMode:{value:'replace'},productImagePickerTargetImageId:{value:'image'},showProductImageUploadPicker:{value:true},prepareProductImageUrl:vi.fn().mockRejectedValue(new Error('Falha BiRefNet'))}
 await applyProductImageFromUploadPicker(ctx as any,{url:'com-fundo.jpg'})
 expect(ctx.replaceImageByCustomId).not.toHaveBeenCalled();expect(ctx.notifyEditorError).toHaveBeenCalled()
})
