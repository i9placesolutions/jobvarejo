import type { ArtComposition, ArtLayer } from '~/types/art-studio'

const luminance = (r: number, g: number, b: number) => .2126*r + .7152*g + .0722*b
export function cartazistaLogoNeedsOutline(pixels: Uint8ClampedArray, background: string): boolean {
  const rgb = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(background)
  if (!rgb || luminance(...rgb.slice(1).map(v=>parseInt(v,16)) as [number,number,number]) > 145) return false
  let visible=0, dark=0, transparent=0
  for(let i=0;i<pixels.length;i+=4){
    if(pixels[i+3]!<40){transparent++;continue}
    if(pixels[i+3]!<200)continue
    visible++
    if(luminance(pixels[i]!,pixels[i+1]!,pixels[i+2]!)<125)dark++
  }
  return transparent>pixels.length/4*.05 && visible>0 && dark/visible>.45
}

/** Contorno acompanha o alfa da marca, sem placa e sem alterar o arquivo original. */
const sourceCache = new Map<string, Promise<string>>()
export function cartazistaLogoSource(layer: ArtLayer, doc: ArtComposition): Promise<string> {
  const background=doc.layers.find(l=>l.id==='cartaz-campaign-base')?.fill||doc.background
  const key=JSON.stringify([layer.src,layer.binding,layer.logoOutline,layer.logoOutlineColor,background])
  let result=sourceCache.get(key)
  if(!result){
    if(sourceCache.size>=32)sourceCache.delete(sourceCache.keys().next().value!)
    result=prepareLogo(layer,background).catch(error=>{sourceCache.delete(key);throw error})
    sourceCache.set(key,result)
  }
  return result
}
async function prepareLogo(layer: ArtLayer, background: string): Promise<string> {
  if(layer.binding!=='logo'||!layer.src||layer.logoOutline===false)return layer.src||''
  const image=new Image();image.crossOrigin='anonymous';image.src=layer.src
  await image.decode()
  const sample=document.createElement('canvas');sample.width=sample.height=96
  const ctx=sample.getContext('2d')!;ctx.drawImage(image,0,0,96,96)
  if(layer.logoOutline!==true&&!cartazistaLogoNeedsOutline(ctx.getImageData(0,0,96,96).data,background))return layer.src
  const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight))
  const w=Math.round(image.naturalWidth*scale),h=Math.round(image.naturalHeight*scale)
  const border=Math.max(2,Math.round(Math.min(w,h)*.025)),pad=border+2
  const mask=document.createElement('canvas');mask.width=w+pad*2;mask.height=h+pad*2
  const m=mask.getContext('2d')!;m.drawImage(image,pad,pad,w,h);m.globalCompositeOperation='source-in';m.fillStyle=layer.logoOutlineColor||'#ffffff';m.fillRect(0,0,mask.width,mask.height)
  const output=document.createElement('canvas');output.width=mask.width;output.height=mask.height
  const out=output.getContext('2d')!
  for(let i=0;i<64;i++){const angle=i*Math.PI/32;out.drawImage(mask,Math.cos(angle)*border,Math.sin(angle)*border)}
  out.drawImage(image,pad,pad,w,h)
  return output.toDataURL('image/png')
}
