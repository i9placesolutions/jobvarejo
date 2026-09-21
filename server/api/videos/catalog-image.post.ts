import {z} from 'zod'
import {GetObjectCommand} from '@aws-sdk/client-s3'
import {videoUser,videoBucket,putVideoAsset} from '../../utils/video-studio/service'
import {prepareVideoImage} from '../../utils/video-studio/images'
import {getS3Client} from '../../utils/s3'
import {extractStorageKeyFromRef} from '../../../utils/storageRef'
import {isValidStoragePath,isStorageKeyAllowedForUser} from '../../utils/storage-scope'
export default defineEventHandler(async event=>{
 const user=await videoUser(event,30),body=z.object({source:z.string().max(3000),name:z.string().max(160)}).parse(await readBody(event))
 const key=extractStorageKeyFromRef(body.source,{bucket:videoBucket(),endpoint:String(useRuntimeConfig().wasabiEndpoint)})
 if(!key||!isValidStoragePath(key)||!isStorageKeyAllowedForUser(key,user.id))throw createError({statusCode:403,statusMessage:'Esta imagem não está disponível no catálogo da sua conta.'})
 const source=await getS3Client().send(new GetObjectCommand({Bucket:videoBucket(),Key:key}))
 if(Number(source.ContentLength)>20*1024*1024)throw createError({statusCode:413,statusMessage:'Imagem muito grande.'})
 const input=Buffer.from(await source.Body!.transformToByteArray());if(input.length>20*1024*1024)throw createError({statusCode:413,statusMessage:'Imagem muito grande.'})
 const img=await prepareVideoImage(input)
 return {...await putVideoAsset(user.id,'image',body.name,img.bytes,'image/png','png',{width:img.width,height:img.height,autoTrim:true,source:key}),aspectRatio:img.aspectRatio}
})
