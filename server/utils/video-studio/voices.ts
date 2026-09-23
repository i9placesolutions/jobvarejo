import { pgQuery,pgOneOrNull } from '../postgres'
export async function videoVoices(userId:string){
 const list:Array<{id:string;name:string}>=[]
 try{const {rows}=await pgQuery<any>("SELECT id,name FROM public.radio_voice_profiles WHERE user_id=$1 AND station_id IS NULL AND status='active' AND consent_status='confirmed' AND sample_storage_key IS NOT NULL ORDER BY name",[userId]);list.push(...rows)}catch(e:any){if(e.code!=='42P01')throw e}
 return list
}
export async function resolveVideoVoice(id:string,userId:string){
 // Novas locuções usam somente a amostra original autorizada do banco de vozes.
 if(/^[a-f0-9-]{36}$/i.test(id)){const row=await pgOneOrNull<any>("SELECT id,gender,sample_storage_key,metadata,created_at FROM public.radio_voice_profiles WHERE id=$1 AND user_id=$2 AND station_id IS NULL AND status='active' AND consent_status='confirmed'",[id,userId]);const key=String(row?.sample_storage_key||'');if(key.startsWith(`radio-indoor/voices/${userId}/`)&&!key.includes('..'))return {sampleKey:key,gender:row.gender,profileId:id,sampleVersion:String(row.metadata?.sourceSha256||row.created_at||'')}}
 throw createError({statusCode:422,statusMessage:'Escolha um locutor disponível ou desative a locução.'})
}
