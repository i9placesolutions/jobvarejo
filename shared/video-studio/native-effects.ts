import {shine} from '@remotion/effects/shine'
import {glow} from '@remotion/effects/glow'
import {chromaticAberration} from '@remotion/effects/chromatic-aberration'
import {zoomBlur} from '@remotion/effects/zoom-blur'
import {outline} from '@remotion/effects/outline'
import type {EffectDescriptor} from 'remotion'
import type {VideoMotionSettings} from './effect-catalog'

export function productEffects(frame:number,finish:VideoMotionSettings['finish'],strength:number):EffectDescriptor<unknown>[] {
  const arrival=Math.max(0,1-frame/8)*strength
  switch(finish){
    case 'shine':return [shine({progress:Math.min(1,Math.max(0,(frame-10)/26)),haloIntensity:.12*strength,coreIntensity:.23*strength,angle:25})]
    case 'glow':return [glow({radius:10,intensity:.12*strength,threshold:.65,color:'#dbff9b'})]
    case 'chromatic':return [chromaticAberration({amount:arrival*12,angle:-18})]
    case 'zoom-blur':return [zoomBlur({amount:arrival*14,samples:10})]
    case 'outline':return [outline({color:'#e8ffbc',width:3})]
    default:return []
  }
}
