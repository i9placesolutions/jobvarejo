import {isAlcoholicProduct} from '../../../utils/product-card-configuration'
import { randomUUID } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { videoUser,videoId,videoBucket,putVideoAsset } from '../../utils/video-studio/service'
import { pgOneOrNull } from '../../utils/postgres'
import { getS3Client } from '../../utils/s3'
import { isValidStoragePath,isStorageKeyAllowedForUser } from '../../utils/storage-scope'
import { extractStorageKeyFromRef } from '../../../utils/storageRef'
export default defineEventHandler(async event=>{
 const u=await videoUser(event,10),body=await readBody(event)
 const row=await pgOneOrNull<any>('SELECT canvas_data FROM public.projects WHERE id=$1 AND user_id=$2',[videoId(body?.projectId),u.id]);if(!row)throw createError({statusCode:404,statusMessage:'Encarte não encontrado.'})
 const cfg=useRuntimeConfig(),keyFor=(ref:unknown)=>{const key=extractStorageKeyFromRef(String(ref||''),{bucket:videoBucket(),endpoint:String(cfg.wasabiEndpoint)});return key&&isValidStoragePath(key)&&isStorageKeyAllowedForUser(key,u.id)?key:null}
 const read=async(key:string)=>{const r=await getS3Client().send(new GetObjectCommand({Bucket:videoBucket(),Key:key}));if(Number(r.ContentLength)>20*1024*1024)throw Error('Arquivo muito grande.');return Buffer.from(await r.Body!.transformToByteArray())}
 const raw=row.canvas_data,pages=Array.isArray(raw)?raw:Array.isArray(raw?.pages)?raw.pages:[raw];const products:any[]=[],seen=new Set<string>();let unread=0,skipped=0
 function walk(node:any,depth=0){if(!node||depth>30||products.length>=80)return;if(Array.isArray(node)){for(const n of node)walk(n,depth+1);return}if(typeof node!=='object')return;const p=node._productData;if(p&&typeof p==='object'){const signature=JSON.stringify([p.name,p.price,p.imageUrl]);if(!seen.has(signature)){seen.add(signature);products.push(p)}}if(Array.isArray(node.products))for(const p of node.products){const signature=JSON.stringify([p.name,p.price,p.imageUrl]);if(!seen.has(signature)){seen.add(signature);products.push(p)}}walk(node.objects,depth+1)}
 for(const page of pages.slice(0,20)){try{let data=page?.canvasData||page;const key=keyFor(page?.canvasDataPath);if(key){const bytes=await read(key);data=JSON.parse((bytes[0]===31&&bytes[1]===139?gunzipSync(bytes,{maxOutputLength:40*1024*1024}):bytes).toString())}if(typeof data==='string')data=JSON.parse(data);walk(data)}catch{unread++}}
 const requested=Array.isArray(body?.indices)?body.indices.filter((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<products.length).slice(0,6):null
 const candidates=products.map((p,i)=>({index:i,name:String(p.name||''),price:typeof p.price==='number'?p.price.toFixed(2).replace('.',','):String(p.price||''),unit:String(p.unit||''),condition:String(p.limitText||p.condition||''),complex:Boolean(p.priceMode&&p.priceMode!=='retail'||p.priceWholesale||p.priceSpecial)}))
 if(!requested)return {items:candidates,warning:unread?'Algumas páginas não puderam ser lidas. Confira a lista antes de importar.':''}
 const offers=[]
 for(const index of requested){const p=products[index],c=candidates[index];if(!p||!c||c.complex){skipped++;continue}let image='';let imageAspectRatio:number|undefined;const key=keyFor(p.imageUrl||p.image);if(key){try{const bytes=await sharp(await read(key),{limitInputPixels:24_000_000}).trim({threshold:10}).resize(1500,1500,{fit:'inside',withoutEnlargement:true}).png().toBuffer();const info=await sharp(bytes).metadata();imageAspectRatio=Number(info.width)/Number(info.height);image=(await putVideoAsset(u.id,'image',c.name,bytes,'image/png','png',{width:info.width,height:info.height})).id}catch{}}
 offers.push({id:randomUUID(),name:c.name.slice(0,120),price:c.price,unit:c.unit.slice(0,30),condition:c.condition.slice(0,140),alcoholBadgeEnabled:typeof p.alcoholBadgeEnabled==='boolean'?p.alcoholBadgeEnabled:isAlcoholicProduct(p),image,imageAspectRatio})}
 return {offers,warning:[skipped?'Ofertas com múltiplos preços precisam ser cadastradas manualmente para preservar as condições.':'',offers.some(o=>!o.image)?'Envie as imagens dos produtos que ficaram sem foto.':''].filter(Boolean).join(' ')}
})
