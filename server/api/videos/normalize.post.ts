import { z } from 'zod'
import { videoUser } from '../../utils/video-studio/service'
import { normalizeVideoSpeech } from '../../utils/video-studio/normalize-speech'
export default defineEventHandler(async event=>{
 await videoUser(event,30)
 const data=z.object({scripts:z.array(z.object({id:z.string().max(40),text:z.string().max(700)})).max(8),pronunciations:z.array(z.object({from:z.string().min(1).max(80),to:z.string().min(1).max(120)})).max(30)}).safeParse(await readBody(event))
 if(!data.success)throw createError({statusCode:422,statusMessage:'Confira o texto e a pronúncia.'})
 try { return { scripts: await normalizeVideoSpeech(data.data.scripts, data.data.pronunciations) } }
 catch (error) { throw createError({ statusCode: 422, statusMessage: error instanceof Error ? error.message : 'Não foi possível preparar a fala. Confira datas e pronúncias.' }) }
})
