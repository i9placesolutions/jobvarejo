import {availableParallelism,totalmem} from 'node:os'
export function renderSettings(env=process.env,cpus=availableParallelism(),memory=totalmem()){
 const automatic=Math.max(1,Math.min(4,Math.floor(cpus/2),Math.floor(memory/(3*1024**3))))
 const requested=Number(env.VIDEO_RENDER_CONCURRENCY)
 const concurrency=Number.isFinite(requested)&&requested>=1?Math.min(16,Math.floor(requested)):automatic
 const allowed=['superfast','veryfast','faster','fast','medium','slow','slower','veryslow','placebo']
 return {concurrency,x264Preset:allowed.includes(env.VIDEO_X264_PRESET)?env.VIDEO_X264_PRESET:'veryfast'}
}
