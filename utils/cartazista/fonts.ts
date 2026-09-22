import type { ArtComposition } from '~/types/art-studio'
import { loadArtFonts } from '~/utils/art-studio/fonts'
import { CARTAZISTA_LETTERING_FONTS } from './typography'

const pending=new Map<string,Promise<void>>()
export async function loadCartazistaFonts(doc:ArtComposition):Promise<void>{
  const dedicated=CARTAZISTA_LETTERING_FONTS.filter(font=>'file' in font)
  await loadArtFonts({...doc,layers:doc.layers.filter(layer=>!dedicated.some(font=>font.family===layer.fontFamily))})
  await Promise.all(doc.layers.filter(layer=>layer.kind==='text').map(async layer=>{
    const font=dedicated.find(font=>font.family===layer.fontFamily)
    if(!font||!('file' in font))return
    const key=`${font.family}:${layer.fontWeight||400}`
    if(!pending.has(key)){
      const task=(async()=>{
        const face=new FontFace(`Art ${font.family}`,`url("/cartazista/fonts/${font.file}")`,{weight:String(layer.fontWeight||400)})
        await face.load();document.fonts.add(face)
      })()
      pending.set(key,task);task.catch(()=>pending.delete(key))
    }
    await pending.get(key)
  }))
}
