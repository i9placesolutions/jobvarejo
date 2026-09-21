import React, {createElement as h} from 'react'
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion'
import type {VideoRenderProps} from './model'

export const BOOM_THEMES = ['flyer-ab690e7b-f393-4416-b81c-e6ad3da654a4', 'flyer-c11924b4-3438-4e49-bd0e-56f702d4843d']
export const isBoomTheme = (theme: string) => BOOM_THEMES.includes(theme)
// Same frames as the opening boom and the offer impact sound. No recurring explosions.
export function explosionEnvelope(local: number, opening: boolean) {
 const age = local - (opening ? 8 : 5)
 return {age, active: age >= 0 && age < 38, expansion: 1 - Math.pow(1 - Math.min(1, Math.max(0, age) / 30), 3), opacity: age < 0 ? 0 : Math.max(0, 1 - age / 38), flash: age < 0 ? 0 : Math.max(0, 1 - age / 5)}
}
/** Layer behind the commercial content: fire core, rolling smoke, shockwave and debris. */
export function BoomExplosion({props}: {props: VideoRenderProps}) {
 const f = useCurrentFrame(), {width:w,height:ht} = useVideoConfig()
 if (!isBoomTheme(props.document.theme)) return null
 const scene = props.scenes.find(s => f >= s.from && f < s.from + s.frames)
 const e = explosionEnvelope(f - (scene?.from || 0), scene?.id === 'intro')
 if (!e.active || scene?.id === 'outro') return null
 const opening = scene?.id === 'intro', cx = w * .5, cy = ht * (opening ? .39 : .57), radius = Math.min(w,ht) * (opening ? .68 : .48), s = props.document.intensity
 const items: React.ReactNode[] = []
 const gold = props.document.theme === BOOM_THEMES[0]
 for (let i=0;i<22;i++) {
  const angle=i*2.399, travel=radius*e.expansion*(.72+(i%5)*.1), size=radius*(.22+e.expansion*.22)*(1+(i%3)*.2)
  items.push(h('div',{key:'smoke'+i,style:{position:'absolute',left:cx+Math.cos(angle)*travel-size/2,top:cy+Math.sin(angle)*travel-size/2-e.age*2,width:size,height:size,borderRadius:'44% 56% 39% 61%',rotate:`${i*41+e.age*(i%2?1:-1)}deg`,background:`radial-gradient(circle at 35% 30%,${gold?'#dfc899':'#edba92'}aa,#54463df0 37%,#1c1814aa 58%,transparent 72%)`,filter:`blur(${3+e.expansion*9}px)`,opacity:e.opacity*s}}))
 }
 items.push(h('div',{key:'core',style:{position:'absolute',left:cx-radius,top:cy-radius,width:radius*2,height:radius*2,borderRadius:'50%',background:'radial-gradient(circle,#fffbd9 0%,#ffcf4dcc 14%,#ff650099 32%,#eb270033 49%,transparent 66%)',scale:.15+e.expansion*1.2,opacity:Math.max(0,1-e.age/18)*s,mixBlendMode:'screen'}}))
 items.push(h('div',{key:'wave',style:{position:'absolute',left:cx-radius,top:cy-radius,width:radius*2,height:radius*2,borderRadius:'50%',border:`${Math.max(1,9-e.age*.3)}px solid #ffd988`,boxShadow:'0 0 22px #ffb52b,inset 0 0 18px #ff7100',scale:.1+e.expansion*1.65,opacity:Math.max(0,1-e.age/20)*s}}))
 for(let i=0;i<36;i++){
  const angle=i*2.399,travel=radius*e.expansion*(.8+(i%7)*.15)
  items.push(h('div',{key:'spark'+i,style:{position:'absolute',left:cx+Math.cos(angle)*travel,top:cy+Math.sin(angle)*travel+e.age*e.age*.16,width:3+i%3,height:12+i%5*7,rotate:`${angle*180/Math.PI-90}deg`,background:'linear-gradient(#fff9cf,#ffb323,transparent)',boxShadow:'0 0 8px #ff8a00',opacity:e.opacity*s}}))
 }
 return h(AbsoluteFill,{style:{pointerEvents:'none',overflow:'hidden'}},...items)
}
