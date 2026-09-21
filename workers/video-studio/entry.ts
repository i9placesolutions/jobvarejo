import { createElement as h } from 'react'
import { registerRoot, Composition } from 'remotion'
import { VideoComposition } from '../../shared/video-studio/composition'
import { newVideoDocument, buildVideoTimeline, VIDEO_FORMATS, type VideoRenderProps } from '../../shared/video-studio/model'
const doc=newVideoDocument();doc.voice.enabled=false
const props:VideoRenderProps={document:doc,format:'vertical',scenes:buildVideoTimeline(doc),media:{}}
const Root=()=>h(Composition<any, VideoRenderProps>,{id:'Offers',component:VideoComposition,durationInFrames:898,fps:30,width:1080,height:1920,defaultProps:props,calculateMetadata:({props:input}:{props:VideoRenderProps})=>({...VIDEO_FORMATS[input.format],durationInFrames:input.scenes.reduce((n,s)=>Math.max(n,s.from+s.frames),1)})})
registerRoot(Root)
