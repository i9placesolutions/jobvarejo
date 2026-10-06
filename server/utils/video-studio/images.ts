import sharp from 'sharp'
import {preserveExistingTransparency,processImageWithOptions} from '../image-processor'

/** Remove o fundo de fotos de produto; recortes transparentes são preservados e falhas usam a foto original. */
async function withoutBackground(input:Buffer):Promise<Buffer>{
 try{
  const preserved=await preserveExistingTransparency(input,'png')
  if(preserved)return preserved
  return await processImageWithOptions(input,{outputFormat:'png'})
 }catch(error){
  console.warn('[video-studio] Remoção de fundo falhou; usando a foto original:',(error as Error)?.message)
  return input
 }
}

export async function prepareVideoImage(input:Buffer,options:{maxEdge?:number;removeBackground?:boolean}={}){
 const source=options.removeBackground?await withoutBackground(input):input
 const bytes=await sharp(source,{limitInputPixels:24_000_000}).rotate().trim({threshold:10}).resize(options.maxEdge||1600,options.maxEdge||1600,{fit:'inside',withoutEnlargement:true}).png().toBuffer()
 const info=await sharp(bytes).metadata()
 return {bytes,width:info.width!,height:info.height!,aspectRatio:info.width!/info.height!}
}
