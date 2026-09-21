import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition, ensureBrowser } from '@remotion/renderer'
import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat, cp, mkdir } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec=promisify(execFile)
export const root=resolve(import.meta.dirname,'../..')
export async function probe(file){const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{timeout:20000});return JSON.parse(stdout)}
let bundlePromise
export async function videoBundle(){bundlePromise ||= bundle({entryPoint:join(root,'workers/video-studio/entry.ts'),publicDir:join(root,'public'),outDir:process.env.VIDEO_BUNDLE_DIR||undefined});return bundlePromise}
export async function renderVideo(input,directory,output,onProgress=()=>{},options={}){
 await ensureBrowser()
 await mkdir(join(directory,'fonts'),{recursive:true})
 await cp(join(root,'public/video-studio/audio/sfx'),join(directory,'sfx'),{recursive:true})
 const {flyerRecipe}=await import('../../shared/video-studio/flyer-recipes.ts');const recipe=flyerRecipe(input.document.theme)
 const {videoBackground,backgroundAsset}=await import('../../shared/video-studio/backgrounds.ts');const chosenBackground=videoBackground(input.document.background);const energy=chosenBackground?backgroundAsset(chosenBackground.id,input.format):input.format==='vertical'?recipe?.energyBackgroundVertical:recipe?.energyBackground
 if(recipe){for(const asset of [recipe.background,energy,recipe.seal,'impact-fire-v2.png','retail-fire-curtain-v1.png'].filter(Boolean)){const target=join(directory,'templates',asset);await mkdir(join(target,'..'),{recursive:true});await cp(join(root,'public/video-studio/templates',asset),target)}}else await cp(join(root,'public/video-studio/templates'),join(directory,'templates'),{recursive:true})
 for(const name of ['Barlow-Bold.ttf','Barlow-ExtraBold.ttf','BarlowCondensed-ExtraBold.ttf'])await cp(join(root,'public/art-studio/fonts',name),join(directory,'fonts',name))
 const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..')||path.includes('\\'))throw Error();const file=join(directory,path),info=await stat(file);if(!info.isFile())throw Error();res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type',({'.png':'image/png','.mp3':'audio/mpeg','.wav':'audio/wav','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=Math.min(info.size-1,range[2]?Number(range[2]):info.size-1);if(start>end){res.writeHead(416);res.end();return}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});createReadStream(file,{start,end}).pipe(res)}else{res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res)}}catch{res.writeHead(404);res.end()}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 const props=JSON.parse(JSON.stringify(input));props.audioBase=base;props.fontBase=base+'/fonts';props.templateBase=base+'/templates'
 for(const key of Object.keys(props.media))props.media[key]=base+'/'+props.media[key]
 for(const scene of props.scenes)if(scene.audio)scene.audio=base+'/'+scene.audio
 for(const key of ['music','impact','whoosh'])if(props[key])props[key]=base+'/'+props[key]
 try{const serveUrl=await videoBundle();const composition=await selectComposition({serveUrl,id:'Offers',inputProps:props,chromiumOptions:{gl:'angle'}});if(Number.isInteger(options.frame)){await renderStill({composition,serveUrl,inputProps:props,chromiumOptions:{gl:'angle'},frame:options.frame,output,imageFormat:'png',scale:options.scale||1});return {frame:options.frame}}await renderMedia({composition,serveUrl,inputProps:props,chromiumOptions:{gl:'angle'},frameRange:options.frameRange,codec:'h264',audioCodec:'aac',pixelFormat:'yuv420p',outputLocation:output,concurrency:Math.max(1,Number(process.env.VIDEO_RENDER_CONCURRENCY||2)),crf:20,onProgress:({progress})=>onProgress(progress),timeoutInMilliseconds:90000});const details=await probe(output);if(Number(details.format?.duration)>input.document.duration+.001||Number(details.format?.duration)>30)throw Error('O vídeo excedeu o limite de duração. Reduza o roteiro.');return details}finally{await new Promise(r=>server.close(r))}
}
