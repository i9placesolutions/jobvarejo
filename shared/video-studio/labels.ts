import {flyerRecipe} from './flyer-recipes'
/** Adapta uma cópia das etiquetas simples existentes. Nunca altera o catálogo Fabric. */
export interface VideoLabelNode { type:string; name:string; x:number;y:number;width:number;height:number;sx:number;sy:number;angle:number;originX:string;originY:string;fill:string;stroke:string;strokeWidth:number;radius:number;rx:number;opacity:number;text:string;fontSize:number;fontFamily:string;fontWeight:string;src?:string;integerSize?:number;decimalSize?:number;decimalOffset?:number }
export interface VideoLabel { id:string; name:string; width:number;height:number;nodes:VideoLabelNode[] }
const color=(v:unknown,fallback='none')=>typeof v==='string'&&/^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent|black|white|none)$/i.test(v)?v:fallback
const number=(v:unknown,d=0)=>Number.isFinite(Number(v))?Math.max(-10000,Math.min(10000,Number(v))):d
export function adaptVideoLabel(row:any):VideoLabel|null {
 const group=row?.group;if(!group||!Array.isArray(group.objects)||group.objects.length>40||/atac|fardo|censur|especial/i.test(row.name||''))return null
 const nodes:VideoLabelNode[]=[]
 for(const o of group.objects){if(o.visible===false)continue;const type=String(o.type).toLowerCase();if(!['rect','circle','text','itext','textbox','image'].includes(type))return null
  const src=type==='image'?String(o.src||''):undefined;if(src&&(!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(src)||src.length>1500000))return null
  nodes.push({type,name:String(o.name||''),x:number(o.left),y:number(o.top),width:number(o.width),height:number(o.height),sx:number(o.scaleX,1),sy:number(o.scaleY,1),angle:number(o.angle),originX:String(o.originX||'left'),originY:String(o.originY||'top'),fill:color(o.fill,'#ffffff'),stroke:color(o.stroke),strokeWidth:number(o.strokeWidth),radius:number(o.radius),rx:number(o.rx),opacity:number(o.opacity,1),text:String(o.text||'').slice(0,100),fontSize:number(o.fontSize,30),fontFamily:String(o.fontFamily||'Barlow'),fontWeight:String(o.fontWeight||'900'),src,integerSize:o.__priceRichText?number(o.__priceRichIntegerStyle?.fontSize,o.fontSize):undefined,decimalSize:o.__priceRichText?number(o.__priceRichDecimalStyle?.fontSize,o.fontSize*.6):undefined,decimalOffset:number(o.__priceRichDecimalOffsetY)})
 }
 if(!nodes.some(n=>/price_(integer|value)_text/.test(n.name)))return null
 return {id:String(row.id),name:String(row.name),width:number(group.width,300),height:number(group.height,160),nodes}
}

// Resolve somente entre as etiquetas entregues pela API da conta atual.
export function resolveVideoLabel(labels:VideoLabel[],theme:string,selected?:string):VideoLabel|undefined {
 if(selected)return labels.find(l=>l.id===selected)
 const recipe=flyerRecipe(theme);if(!recipe)return undefined
 return recipe.labelNames.map(name=>labels.find(l=>l.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))).find(Boolean)||labels.find(l=>l.id==='tpl_default')||labels[0]
}
