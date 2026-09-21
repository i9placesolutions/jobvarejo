import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { z } from 'zod'
import { videoUser } from '../../utils/video-studio/service'
export default defineEventHandler(async event=>{
 await videoUser(event,30)
 const data=z.object({scripts:z.array(z.object({id:z.string().max(40),text:z.string().max(700)})).max(8),pronunciations:z.array(z.object({from:z.string().min(1).max(80),to:z.string().min(1).max(120)})).max(30)}).safeParse(await readBody(event))
 if(!data.success)throw createError({statusCode:422,statusMessage:'Confira o texto e a pronúncia.'})
 return new Promise((resolveResult,reject)=>{const child=spawn(process.env.VIDEO_STUDIO_PYTHON||'python3',[resolve('workers/video-studio/normalize.py')],{stdio:['pipe','pipe','pipe']});let output='';const timer=setTimeout(()=>{child.kill();reject(createError({statusCode:504,statusMessage:'A preparação da fala demorou demais.'}))},10000);child.stdout.on('data',d=>{output+=String(d);if(output.length>64000)child.kill()});child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(createError({statusCode:503,statusMessage:'A preparação de locução ainda não está disponível no servidor.'}))});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(createError({statusCode:422,statusMessage:'Não foi possível preparar a fala. Confira datas e a configuração do serviço de voz.'}));try{resolveResult(JSON.parse(output))}catch{reject(createError({statusCode:502,statusMessage:'Resposta de locução inválida.'}))}});child.stdin.end(JSON.stringify(data.data))})
})
