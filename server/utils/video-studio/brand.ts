import sharp from 'sharp'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { putVideoAsset,videoBucket } from './service'
import { pgOneOrNull } from '../postgres'
import { normalizeBusinessProfile } from '../../../utils/businessProfile'
import { extractStorageKeyFromRef } from '../../../utils/storageRef'
import { isValidStoragePath,isStorageKeyAllowedForUser } from '../storage-scope'
import { getS3Client } from '../s3'
export async function loadVideoBrand(userId:string){const u={id:userId};const profile=await pgOneOrNull<any>('SELECT business_profile FROM public.profiles WHERE id=$1',[u.id]);const b=normalizeBusinessProfile(profile?.business_profile);let logo='';let warning=''
 if(b.logo){const cfg=useRuntimeConfig();const key=extractStorageKeyFromRef(b.logo,{bucket:videoBucket(),endpoint:String(cfg.wasabiEndpoint)});if(key&&isValidStoragePath(key)&&isStorageKeyAllowedForUser(key,u.id)){try{const r=await getS3Client().send(new GetObjectCommand({Bucket:videoBucket(),Key:key}));if((r.ContentLength||0)>10*1024*1024)throw Error();const bytes=Buffer.from(await r.Body!.transformToByteArray());const img=await sharp(bytes,{limitInputPixels:24_000_000}).trim({threshold:15}).resize(1000,1000,{fit:'inside',withoutEnlargement:true}).png().toBuffer();logo=(await putVideoAsset(u.id,'image','Logo da empresa',img,'image/png','png')).id}catch{warning='Não foi possível trazer a logo. Você pode enviar a imagem.'}}else warning='Envie a logo para usá-la neste vídeo.'}
 return {brand:{name:b.companyName,logo,address:b.address,whatsapp:b.whatsapp,instagram:b.instagram,phone:b.phone,facebook:b.facebook,website:b.website,slogan:b.slogan,hours:b.hours,paymentNotes:b.paymentNotes,addresses:b.addresses.map(a=>a.value).filter(v=>v!==b.address),whatsappNumbers:b.whatsappNumbers.map(a=>a.value).filter(v=>v!==b.whatsapp)},warning}
}
