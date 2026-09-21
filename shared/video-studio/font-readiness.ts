import {useEffect,useState} from 'react'
import {useDelayRender} from 'remotion'
const pending=new Map<string,Promise<void>>()
/** Load price fonts before the first captured frame, including scenes not mounted yet. */
export function useRetailFonts(base:string){
 const {delayRender,continueRender,cancelRender}=useDelayRender()
 const [handle]=useState(()=>delayRender('Carregando fontes do vídeo'))
 useEffect(()=>{
  let load=pending.get(base)
  if(!load){load=Promise.all([
   ['ShowcaseCondensed','BarlowCondensed-ExtraBold.ttf','800'],
   ['VideoCondensed','BarlowCondensed-ExtraBold.ttf','900'],
   ['VideoBarlow','Barlow-ExtraBold.ttf','900']
  ].map(async([family,file,weight])=>{const face=await new FontFace(family!,`url("${base}/${file}")`,{weight}).load();document.fonts.add(face)})).then(()=>undefined);pending.set(base,load);load.catch(()=>pending.delete(base))}
  load.then(()=>continueRender(handle),cancelRender)
  return ()=>continueRender(handle)
 },[base,handle,continueRender,cancelRender])
}
