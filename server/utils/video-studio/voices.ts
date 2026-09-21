import { pgQuery,pgOneOrNull } from '../postgres'
export async function videoVoices(userId:string){
 const config=useRuntimeConfig();const list:Array<{id:string;name:string}>=[]
 if(config.musicgptDefaultVoiceId||process.env.MUSICGPT_DEFAULT_VOICE_ID)list.push({id:'default',name:'Locutor padrão'})
 try{const {rows}=await pgQuery<any>("SELECT id,name FROM public.radio_voice_profiles WHERE user_id=$1 AND station_id IS NULL AND status='active' AND consent_status='confirmed' AND metadata ? 'cloneSampleKey' ORDER BY name",[userId]);list.push(...rows)}catch(e:any){if(e.code!=='42P01')throw e}
 return list
}
export async function resolveVideoVoice(id:string,userId:string){
 const config=useRuntimeConfig();if(id==='default'){const voiceId=String(config.musicgptDefaultVoiceId||process.env.MUSICGPT_DEFAULT_VOICE_ID||'');if(voiceId)return {voiceId,gender:String(config.musicgptDefaultVoiceGender||'female')}}
 if(/^[a-f0-9-]{36}$/i.test(id)){const row=await pgOneOrNull<any>("SELECT id,gender,metadata FROM public.radio_voice_profiles WHERE id=$1 AND user_id=$2 AND station_id IS NULL AND status='active' AND consent_status='confirmed'",[id,userId]);const key=String(row?.metadata?.cloneSampleKey||'');if(key.startsWith(`radio-indoor/voices/${userId}/`)&&!key.includes('..'))return {sampleKey:key,gender:row.gender,profileId:id}}
 throw createError({statusCode:422,statusMessage:'Escolha um locutor disponível ou desative a locução.'})
}
