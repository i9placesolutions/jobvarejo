import {prepareVideoImage} from '../../../utils/video-studio/images'
import { videoUser,putVideoAsset } from '../../../utils/video-studio/service'
export default defineEventHandler(async event=>{
 const user=await videoUser(event,30)
 const length=Number(getHeader(event,'content-length')||0);if(length>20*1024*1024)throw createError({statusCode:413,statusMessage:'Use arquivos de até 20 MB.'})
 const parts=await readMultipartFormData(event),file=parts?.find(p=>p.name==='file');if(!file?.data.length||file.data.length>20*1024*1024)throw createError({statusCode:422,statusMessage:'Selecione um arquivo de até 20 MB.'})
 const kind=parts?.find(p=>p.name==='kind')?.data.toString()==='music'?'music':'image'
 if(kind==='image'){try{const {bytes,width,height,aspectRatio}=await prepareVideoImage(file.data);return {...await putVideoAsset(user.id,'image',file.filename||'Imagem',bytes,'image/png','png',{width,height,autoTrim:true}),aspectRatio}}catch{throw createError({statusCode:422,statusMessage:'Use uma imagem PNG, JPG ou WebP válida.'})}}
 // O worker valida/decodifica o áudio com ffprobe antes de usá-lo.
 if(!['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/flac'].includes(file.type||''))throw createError({statusCode:422,statusMessage:'Use uma música MP3, WAV, M4A, OGG ou FLAC.'})
 return putVideoAsset(user.id,'music',file.filename||'Minha música',file.data,file.type!,'audio')
})
