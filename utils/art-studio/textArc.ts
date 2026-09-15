import type { ArtLayer } from '~/types/art-studio'
/** Positions glyph centers on a circular arc, fitted inside the editable box. */
export function artTextArc(layer: ArtLayer, measure: (text: string, size: number) => number) {
  const chars = Array.from((layer.text || '').replace(/\n/g, ' '))
  const size = layer.fontSize || 48
  const widths = chars.map(c => (measure(c, size) + (layer.letterSpacing || 0)) * (layer.fontScaleX || 1))
  const total = widths.reduce((a,b)=>a+b,0) || 1
  const sweep = Math.max(-180, Math.min(180, layer.textArc || 0)) * Math.PI / 180
  const radius = total / (Math.abs(sweep) || .00001)
  let offset = 0
  const points = chars.map((char,i)=>{
    const angle = ((offset + widths[i]! / 2) / total - .5) * sweep
    offset += widths[i]!
    return {char, x: radius * Math.sin(angle) * Math.sign(sweep || 1), y: radius * (1-Math.cos(angle)) * Math.sign(sweep || 1), angle: angle*180/Math.PI}
  })
  const pad = size
  const minX = Math.min(0,...points.map(p=>p.x))-pad, maxX=Math.max(0,...points.map(p=>p.x))+pad
  const minY = Math.min(0,...points.map(p=>p.y))-pad, maxY=Math.max(0,...points.map(p=>p.y))+pad
  const scale=Math.min(1,layer.width/(maxX-minX),layer.height/(maxY-minY))
  return points.map(p=>({...p,x:(p.x-(minX+maxX)/2)*scale+layer.width/2,y:(p.y-(minY+maxY)/2)*scale+layer.height/2,fontSize:size*scale}))
}
export function measureArtText(layer: ArtLayer) {
  const ctx = document.createElement('canvas').getContext('2d')!
  return (text:string,size:number)=>{ctx.font=`${layer.fontWeight || 400} ${size}px "Art ${layer.fontFamily || 'Barlow'}"`; return ctx.measureText(text).width}
}
