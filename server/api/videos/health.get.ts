import { videoUser,videoWorkerReady } from '../../utils/video-studio/service'
export default defineEventHandler(async event=>{await videoUser(event);try{return {ready:await videoWorkerReady(),musicgpt:!!(process.env.MUSICGPT_API_KEY||useRuntimeConfig().musicgptApiKey)}}catch(e:any){if(e.code==='42P01')return {ready:false,musicgpt:false};throw e}})
