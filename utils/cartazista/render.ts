import type { ArtComposition } from '~/types/art-studio'
import { loadArtFonts } from '~/utils/art-studio/fonts'

export async function fitCartazistaComposition(source: ArtComposition): Promise<ArtComposition> {
  const { Textbox } = await import('fabric')
  await loadArtFonts(source)
  const doc: ArtComposition=JSON.parse(JSON.stringify(source))
  for(const layer of doc.layers.filter(l=>l.kind==='text')) {
    const width=layer.width/(layer.fontScaleX||1)
    const object=new Textbox(layer.text||'',{width,fontFamily:`Art ${layer.fontFamily||'Barlow'}`,fontSize:layer.fontSize||48,fontWeight:layer.fontWeight||400,lineHeight:layer.lineHeight??1.16})
    while((object.height>layer.height+.01||object.width>width+.01)&&object.fontSize>6){object.set({fontSize:object.fontSize-1,width});object.initDimensions()}
    layer.fontSize=object.fontSize
    object.dispose()
  }
  return doc
}

/** A galeria e a impressão usam as mesmas métricas Fabric do editor. */
async function renderCartazista(source: ArtComposition, raster = false): Promise<string> {
  const doc=await fitCartazistaComposition(source)
  const { StaticCanvas, Textbox, Rect, Ellipse, Path, FabricImage } = await import('fabric')
  await loadArtFonts(doc)
  const canvas = new StaticCanvas(undefined, { width: doc.width, height: doc.height, backgroundColor: doc.background, renderOnAddRemove: false })
  try {
    for(const layer of doc.layers.filter(l=>l.visible)) {
      const options = {left:layer.x,top:layer.y,originX:'left' as const,originY:'top' as const,fill:layer.fill,opacity:layer.opacity,angle:layer.rotation,strokeWidth:0}
      if(layer.kind==='text') {
        const object = new Textbox(layer.text||'',{...options,width:layer.width/(layer.fontScaleX||1),scaleX:layer.fontScaleX||1,fontFamily:`Art ${layer.fontFamily||'Barlow'}`,fontWeight:layer.fontWeight||400,fontSize:layer.fontSize||48,textAlign:layer.align||'left',lineHeight:layer.lineHeight??1.16,charSpacing:(layer.letterSpacing||0)/(layer.fontSize||48)*1000})
        while((object.height>layer.height+.01 || object.width*object.scaleX>layer.width+.01)&&object.fontSize>6){object.set({fontSize:object.fontSize-1,width:layer.width/(layer.fontScaleX||1)});object.initDimensions()}
        canvas.add(object)
      } else if(layer.kind==='shape'&&layer.shape==='path'&&layer.pathData) {
        const object=new Path(layer.pathData,options)
        object.set({scaleX:layer.width/object.width,scaleY:layer.height/object.height});canvas.add(object)
      } else if(layer.kind==='shape'&&layer.shape==='ellipse')canvas.add(new Ellipse({...options,rx:layer.width/2,ry:layer.height/2}))
      else if(layer.kind==='shape')canvas.add(new Rect({...options,width:layer.width,height:layer.height,rx:layer.cornerRadius||0,ry:layer.cornerRadius||0}))
      else if(layer.kind==='image'&&layer.src) {
        const object=await FabricImage.fromURL(layer.src,{crossOrigin:'anonymous'})
        const scale=layer.fit==='cover'?Math.max(layer.width/object.width,layer.height/object.height):Math.min(layer.width/object.width,layer.height/object.height)
        if(layer.fit==='cover') {
          const w=layer.width/scale,h=layer.height/scale
          object.set({cropX:(object.width-w)/2,cropY:(object.height-h)/2,width:w,height:h})
        }
        object.set({...options,scaleX:scale,scaleY:scale,left:layer.x+(layer.width-object.width*scale)/2,top:layer.y+(layer.height-object.height*scale)/2});canvas.add(object)
      }
    }
    return raster ? canvas.toDataURL({format:'png',multiplier:Math.min(3,6000/Math.max(doc.width,doc.height)),enableRetinaScaling:false}) : canvas.toSVG({suppressPreamble:true})
  } finally { await canvas.dispose() }
}

export const renderCartazistaSvg = (source: ArtComposition) => renderCartazista(source)
export const renderCartazistaPng = (source: ArtComposition) => renderCartazista(source, true)
