import sharp from 'sharp'
export async function prepareVideoImage(input:Buffer,maxEdge=1600){
 const bytes=await sharp(input,{limitInputPixels:24_000_000}).rotate().trim({threshold:10}).resize(maxEdge,maxEdge,{fit:'inside',withoutEnlargement:true}).png().toBuffer()
 const info=await sharp(bytes).metadata()
 return {bytes,width:info.width!,height:info.height!,aspectRatio:info.width!/info.height!}
}
