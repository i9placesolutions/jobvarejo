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
  const main = String(palette?.main || '').replace('#','')
  const channels = main.length===6 ? [0,2,4].map(offset=>parseInt(main.slice(offset,offset+2),16)) : null
  const luminance = channels ? (0.2126*channels[0] + 0.7152*channels[1] + 0.0722*channels[2]) / 255 : 0
  const foreground = luminance > .56 ? palette.ink : palette.surface
  const panelFill = luminance > .56 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)'
  const panelStroke = luminance > .56 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.42)'
  for(const object of canvas.objects||[]){
    const name=object.name||''
    if(name==='footer-premium-background'){
      // Uma faixa translúcida preserva a arte nas bordas e dá contraste
      // constante para os campos comerciais e os cartões do cadastro.
      object.fill=palette.main;object.opacity=.94;object.stroke=palette.surface;object.strokeWidth=Math.max(1,Number(object.strokeWidth||0))
    }
    else if(name==='standard-validity-background')object.fill=palette.surface
    else if(/^reference-validity-.*-band$/.test(name))object.fill=palette.main
    else if(name==='header-validity'){object.fill=palette.ink;object.styles={}}
    else if(/^footer-(title-|dynamic-)/.test(name)){object.fill=foreground;object.styles={}}
    else if(/^footer-contact-/.test(name)){object.fill=panelFill;object.stroke=panelStroke;object.opacity=1}
    else if(/^header-validity-calendar/.test(name)){
      if(name==='header-validity-calendar'){object.fill='#ffffff';object.stroke=palette.ink}
      else object.fill=palette.main
    }
  }
}
