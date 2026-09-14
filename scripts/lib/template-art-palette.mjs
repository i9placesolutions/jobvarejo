import sharp from 'sharp'

export async function paletteFromArtwork(buffer) {
  const {data,info}=await sharp(buffer).resize(64,64,{fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true})
  const bins=Array.from({length:12},()=>({weight:0,r:0,g:0,b:0}))
  for(let i=0;i<data.length;i+=info.channels){
    const r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min
    if(delta<35||max<45||min>205)continue
    let h=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4
    h=(h*60+360)%360
    const bin=bins[Math.floor(h/30)],weight=delta/255
    bin.weight+=weight;bin.r+=r*weight;bin.g+=g*weight;bin.b+=b*weight
  }
  const dominant=bins.sort((a,b)=>b.weight-a.weight)[0]
  const rgb=dominant.weight?[dominant.r,dominant.g,dominant.b].map(x=>x/dominant.weight):[75,75,75]
  const hex=values=>'#'+values.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')
  return {main:hex(rgb.map(x=>x*.7)),ink:hex(rgb.map(x=>x*.24)),surface:hex(rgb.map(x=>x*.17+255*.83))}
}
export function applyArtworkPalette(canvas,palette){
  for(const object of canvas.objects||[]){
    const name=object.name||''
    if(name==='footer-premium-background'){object.fill='transparent';object.stroke='transparent'}
    else if(name==='standard-validity-background')object.fill=palette.surface
    else if(/^reference-validity-.*-band$/.test(name))object.fill=palette.main
    else if(name==='header-validity'||/^footer-(title-|dynamic-)/.test(name)){object.fill=palette.ink;object.styles={}}
    else if(/^footer-contact-/.test(name))object.stroke=palette.main
    else if(/^header-validity-calendar/.test(name)){
      if(name==='header-validity-calendar'){object.fill='#ffffff';object.stroke=palette.ink}
      else object.fill=palette.main
    }
  }
}
