import React,{createElement as h,useRef} from 'react'
import {useVideoConfig} from 'remotion'
import {elementNames,elementTransform,type VideoElementTransform} from './layout-editing'
import type {VideoRenderProps} from './model'
export function EditableElement({props,scene,id,style,children}:{props:VideoRenderProps;scene:string;id:string;style:React.CSSProperties;children?:React.ReactNode}){
 const {width}=useVideoConfig(),drag=useRef<{x:number;y:number;ratio:number;value:VideoElementTransform}|null>(null)
 const value=elementTransform(props.document,props.format,scene,id),editor=props.editor,editing=editor?.enabled&&editor.sceneId===scene,selected=editing&&editor.selected===id
 if(value.hidden&&!editing)return null
 const numeric=(v:unknown)=>typeof v==='number'?v:0
 const rotate=parseFloat(String(style.rotate||0))+value.rotation
 return h('div',{
  'data-video-element':id,
  style:{...style,left:numeric(style.left)+value.x,top:numeric(style.top)+value.y,scale:(Number(style.scale)||1)*value.scale,rotate:`${rotate}deg`,opacity:value.hidden?.22:style.opacity,cursor:editing?'move':undefined,touchAction:editing?'none':undefined,outline:selected?'4px solid #4ee7b6':editing?'2px dashed #ffffff55':undefined,outlineOffset:4},
  onPointerDown:editing?(e:React.PointerEvent<HTMLDivElement>)=>{e.preventDefault();e.stopPropagation();editor.select(id);e.currentTarget.setPointerCapture(e.pointerId);const parent=e.currentTarget.parentElement!;drag.current={x:e.clientX,y:e.clientY,ratio:parent.getBoundingClientRect().width/width,value:{...value}}}:undefined,
  onPointerMove:editing?(e:React.PointerEvent<HTMLDivElement>)=>{const start=drag.current;if(!start)return;editor.change(id,{...start.value,x:Math.round(start.value.x+(e.clientX-start.x)/start.ratio),y:Math.round(start.value.y+(e.clientY-start.y)/start.ratio)})}:undefined,
  onPointerUp:editing?(e:React.PointerEvent<HTMLDivElement>)=>{drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}:undefined,
  onPointerCancel:()=>{drag.current=null}
 },h('div',{style:{width:'100%',height:'100%',display:style.display,alignItems:style.alignItems,justifyContent:style.justifyContent,pointerEvents:editing?'none':undefined}},children),selected?h('span',{style:{position:'absolute',top:0,left:0,background:'#063c30',color:'#fff',font:'bold 30px sans-serif',padding:'6px 10px',whiteSpace:'nowrap'}},elementNames[id]||id):null)
}
