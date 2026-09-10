import { describe, expect, it } from 'vitest'
import { repairDynamicTextLayoutBounds } from '../../utils/dynamicTextLayoutBounds'
const object = (values: Record<string, any>): any => ({type:'rect',left:0,top:0,width:100,height:20,scaleX:1,scaleY:1,...values,set(v:any){Object.assign(this,v)},setCoords(){},getBoundingRect(){return {left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY}}})
const fixture = () => [object({_customId:'frame',isFrame:true,width:1080,height:1920}),object({parentFrameId:'frame',isProductZone:true,top:300,height:1520}),object({parentFrameId:'frame',type:'i-text',text:'SIGA NOSSO INSTAGRAM',top:1840}),object({parentFrameId:'frame',top:1824,width:1080,height:110}),object({parentFrameId:'frame',type:'i-text',text:'SIGA NOSSO INSTAGRAM',top:1850,height:22}),object({parentFrameId:'frame',type:'textbox',businessProfileField:'instagram',top:1880,height:58,fontSize:20}),object({parentFrameId:'frame',type:'textbox',businessProfileField:'whatsapp',top:1880,height:28,fontSize:20})]
describe('limites dos textos dinâmicos',()=>{
 it('acomoda duas linhas preservando fontes, produtos e elementos antigos encobertos',()=>{const objects=fixture();const zone=JSON.stringify(objects[1]),hidden=JSON.stringify(objects[2]);const result=repairDynamicTextLayoutBounds(objects);expect(result).toEqual({changed:true,unresolved:[]});expect(objects[5].top+objects[5].height).toBe(1916);expect(objects[5].fontSize).toBe(20);expect(objects[5].top).toBe(objects[6].top);expect(JSON.stringify(objects[1])).toBe(zone);expect(JSON.stringify(objects[2])).toBe(hidden);expect(repairDynamicTextLayoutBounds(objects)).toEqual({changed:false,unresolved:[]})})
 it('não invade os produtos quando falta espaço para a tipografia',()=>{const objects=fixture();objects[1].height=1580;const before=objects[5].top;const result=repairDynamicTextLayoutBounds(objects);expect(result.unresolved.length).toBeGreaterThan(0);expect(objects[5].top).toBe(before)})
 it('mantém a borda ao lado do ícone ao corrigir excesso de largura',()=>{const f=object({_customId:'frame',isFrame:true,width:1080,height:1920});const text=object({type:'textbox',parentFrameId:'frame',businessProfileField:'address',left:800,top:1800,width:300,fontSize:20});expect(repairDynamicTextLayoutBounds([f,text]).unresolved).toEqual([]);expect(text.left).toBe(800);expect(text.width).toBe(276);expect(text.fontSize).toBe(20)})
})

it('usa a largura da faixa para a data real sem diminuir a fonte',()=>{
 const frame=object({_customId:'f',isFrame:true,width:1080,height:1350});
 const band=object({parentFrameId:'f',name:'validity-backdrop',left:30,top:493,width:1020,height:40});
 const icon=object({parentFrameId:'f',quickDynamicIconFor:'validity',left:60,top:500,width:26,height:26});
 const text=object({parentFrameId:'f',type:'textbox',quickDataField:'validity',left:100,top:500,width:830,height:46,fontSize:20,textLines:['linha','estoques'],initDimensions(){this.textLines=this.width>=900?['linha completa']:['linha','estoques'];this.height=this.textLines.length*23},getLineWidth(){return 920}});
 repairDynamicTextLayoutBounds([frame,band,icon,text]);expect(text.textLines).toHaveLength(1);expect(text.fontSize).toBe(20);expect(text.left+text.width).toBeLessThan(band.left+band.width);expect(icon.left).toBeLessThan(text.left);
});
