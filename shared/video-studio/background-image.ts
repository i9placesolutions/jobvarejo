import {createElement as h} from 'react'
import {Img} from 'remotion'
import {backgroundAsset} from './backgrounds'
import type {VideoRenderProps} from './model'
export function VideoBackgroundImage({props}:{props:VideoRenderProps}) {
  if(!props.document.background)return null
  return h(Img,{src:(props.templateBase||'/video-studio/templates')+'/'+backgroundAsset(props.document.background,props.format),style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}})
}
