import {springTiming} from '@remotion/transitions'
import {noise2D} from '@remotion/noise'
import type {CameraMovement, ProductEntrance, SceneTransition} from './effect-catalog'
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
const springFast=springTiming({durationInFrames:13,config:{damping:13,stiffness:260,mass:.6},durationRestThreshold:.001})
const springBalanced=springTiming({durationInFrames:19,config:{damping:18,stiffness:220,mass:.7},durationRestThreshold:.001})

// Distâncias curtas conservam a embalagem inteira durante a entrada.
export function elementMotion(frame:number,kind:ProductEntrance,copy=0,speed:'fast'|'balanced'='fast') {
  const f=frame-copy*3, end=speed==='fast'?13:19
  const progress=f>=end?1:f<=0?0:(speed==='fast'?springFast:springBalanced).getProgress({frame:f,fps:30})
  const t=1-progress,sign=copy%2?-1:1,opacity=clamp(f/2)
  let x=0,y=0,rotation=0,scale=1
  switch(kind){
    case 'slam':scale=1-.48*t;y=75*t*sign;rotation=9*t*sign;break
    case 'whip-left':x=-165*t*sign;rotation=-13*t*sign;scale=1-.24*t;break
    case 'whip-right':x=165*t*sign;rotation=13*t*sign;scale=1-.24*t;break
    case 'rise':y=175*t*sign;rotation=-8*t*sign;scale=1-.3*t;break
    case 'drop':y=-165*t*sign;rotation=10*t*sign;scale=1-.25*t;break
    case 'tilt':x=85*t*sign;y=40*t;rotation=32*t*sign;scale=1-.28*t;break
    case 'elastic':y=95*t*sign;scale=1-.6*t;rotation=-12*t*sign;break
    case 'zoom-out':scale=1+.35*t;x=40*t*sign;rotation=6*t*sign;break
  }
  return {x,y,rotation,scale,opacity,progress}
}

export function cameraMotion(frame:number,sceneFrame:number,mode:CameraMovement,strength:number) {
  if(mode==='none'||strength===0||sceneFrame<5||sceneFrame>=24)return {x:0,y:0,rotation:0,zoom:0}
  const f=sceneFrame-5,hit=f>=0&&f<19?Math.pow(1-f/19,1.7)*strength:0
  const jitter=noise2D('retail-camera-x',frame*.46,1),jitterY=noise2D('retail-camera-y',frame*.51,3)
  switch(mode){
    case 'earthquake':return {x:jitter*64*hit,y:jitterY*42*hit,rotation:Math.sin(f*1.8)*2*hit,zoom:.045*hit}
    case 'handheld':return {x:jitter*23*hit+noise2D('hand-x',frame*.045,1)*7*hit,y:jitterY*20*hit+noise2D('hand-y',frame*.04,1)*5*hit,rotation:noise2D('hand-r',frame*.035,1)*.55*hit,zoom:.02*hit}
    case 'swing':return {x:Math.sin(frame*.17)*7*hit,y:Math.sin(frame*.13)*4*hit,rotation:Math.sin(frame*.18)*.75*hit+Math.sin(f*1.2)*hit,zoom:.025*hit}
    case 'zoom-pulse':return {x:jitter*16*hit,y:jitterY*12*hit,rotation:0,zoom:(.016*(1+Math.sin(frame*.15))+.055)*hit}
    default:return {x:Math.sin(f*1.65)*38*hit,y:Math.cos(f*2.1)*24*hit,rotation:Math.sin(f*1.3)*1.45*hit+Math.sin(frame*.19)*.24*hit,zoom:.04*hit}
  }
}

export function transitionMotion(frame:number,mode:SceneTransition) {
  const empty={energy:0,flash:0,zoom:0,x:0,y:0,rotation:0,blur:0,cover:0,chromatic:0}
  if(frame < -5 || frame>10)return empty
  const energy=frame<0?Math.pow((frame+5)/5,2):Math.pow(1-frame/10,3),peak=Math.max(0,1-Math.abs(frame)/4)
  const out={...empty,energy}
  switch(mode){
    case 'fade':return out
    case 'light':return {...out,zoom:energy*.08,flash:peak*.48}
    case 'slide':return {...out,x:Math.sin(frame*.55)*energy*95,zoom:energy*.12,blur:energy*9}
    case 'smoke':return {...out,zoom:energy*.06,blur:energy*6,cover:peak*.75}
    case 'snap-zoom':return {...out,zoom:energy*.21,blur:energy*5,flash:peak*.18}
    case 'whip-up':return {...out,y:Math.sin(frame*.5)*energy*105,zoom:energy*.16,blur:energy*8}
    case 'spin':return {...out,rotation:Math.sin(frame*.35)*energy*5,zoom:energy*.16,blur:energy*4}
    case 'diagonal':return {...out,x:energy*35,y:-energy*25,zoom:energy*.08,cover:peak}
    case 'shutter':return {...out,cover:peak,zoom:energy*.05}
    case 'iris':return {...out,cover:peak,zoom:energy*.12}
    case 'rgb':return {...out,x:Math.sin(frame*2)*energy*22,zoom:energy*.05,chromatic:energy}
    case 'blur':return {...out,blur:energy*17,zoom:energy*.06}
  }
}
