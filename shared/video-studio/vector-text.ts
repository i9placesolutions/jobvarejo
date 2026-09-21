import {createElement as h} from 'react'
import outlines from './price-glyphs.json'
type Glyph={advance:number;path:string}
type Options={x:number;y:number;size:number;width?:number;anchor?:string;condensed?:boolean;fill?:string;stroke?:string;strokeWidth?:number;opacity?:number}
/** SVG outlines avoid Chromium's text metrics cache while the label scales on entrance. */
export function vectorText(text:string,o:Options){
 const font=outlines[o.condensed?'condensed':'barlow'],glyphs=font.glyphs as Record<string,Glyph>
 const chars=Array.from(text).map(c=>glyphs[c]||glyphs['?']!),advance=chars.reduce((n,g)=>n+g.advance,0),sy=o.size/font.units,sx=o.width!==undefined&&advance?o.width/advance:sy,width=advance*sx
 const shift=o.anchor==='middle'?width/2:o.anchor==='end'?width:0
 let cursor=0
 return h('g',{transform:`translate(${o.x-shift} ${o.y}) scale(${sx} ${-sy})`,fill:o.fill,stroke:o.stroke,strokeWidth:(o.strokeWidth||0)/(sy||1),opacity:o.opacity,paintOrder:'stroke',strokeLinejoin:'round','aria-label':text},...chars.map((g,i)=>{const x=cursor;cursor+=g.advance;return g.path?h('path',{key:i,d:g.path,transform:`translate(${x} 0)`}):null}))
}
