import React from 'react'
import {useCurrentFrame, useVideoConfig} from 'remotion'
import {showVideoAlcoholBadge} from './personalization'
import type {VideoRenderProps} from './model'

// Camada comum a todas as famílias, presente na prévia e no MP4.
// SVG inline evita uma dependência externa no worker de renderização.
export function VideoAlcoholBadge({document,scenes}:VideoRenderProps) {
  const frame=useCurrentFrame(), {width,height}=useVideoConfig()
  const scene=scenes.find(s=>frame>=s.from&&frame<s.from+s.frames)
  const offer=document.offers.find(o=>o.id===scene?.id)
  if(!offer||!showVideoAlcoholBadge(offer))return null
  const vertical=height>width, size=vertical?42:46
  return React.createElement('div',{style:{position:'absolute',right:vertical?34:38,bottom:8,zIndex:100,pointerEvents:'none',display:'flex',alignItems:'center',gap:8,background:'#fff',color:'#161616',padding:'4px 10px',borderRadius:14,fontFamily:'Arial, sans-serif'}},
    React.createElement('svg',{width:size,height:size,viewBox:'0 0 100 100','aria-label':'Proibido para menores de 18 anos'},
      React.createElement('circle',{cx:50,cy:50,r:44,fill:'white',stroke:'#c92330',strokeWidth:8}),
      React.createElement('text',{x:50,y:65,textAnchor:'middle',fontSize:42,fontWeight:900,fill:'#111'},'18'),
      React.createElement('path',{d:'M20 80 L80 20',stroke:'#c92330',strokeWidth:8})),
    React.createElement('span',{style:{fontSize:vertical?17:18,fontWeight:700,lineHeight:1.2,maxWidth:vertical?175:195}},'Venda proibida a menores de 18 anos'))
}
