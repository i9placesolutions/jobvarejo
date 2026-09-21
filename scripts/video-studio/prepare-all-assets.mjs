import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3'
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import sharp from 'sharp'
const root='output/video-all-models',out='public/video-studio/templates/catalog';await mkdir(out,{recursive:true})
const sources=JSON.parse(await readFile(root+'/sources.json'));const cfg=n=>process.env[n]||process.env['NUXT_'+n]
const s3=new S3Client({endpoint:'https://'+cfg('WASABI_ENDPOINT').replace(/^https?:\/\//,''),region:cfg('WASABI_REGION'),credentials:{accessKeyId:cfg('WASABI_ACCESS_KEY'),secretAccessKey:cfg('WASABI_SECRET_KEY')}})
const records=[];let cursor=0
await Promise.all(Array.from({length:5},async()=>{while(cursor<sources.length){const source=sources[cursor++];const canvas=JSON.parse(await readFile(root+'/'+source.id+'.json'));const bg=canvas.objects.find(o=>/^fundo/i.test(o.name||'')),seal=canvas.objects.find(o=>/selo/i.test(o.name||''));const result={id:source.id,name:source.name,background:'',seal:'',nativeTitle:seal?.text||'',gradient:typeof bg?.fill==='object'?bg.fill?.colorStops:undefined};
 for(const [kind,obj] of [['background',bg],['seal',seal]])if(obj?.src){const url=new URL(obj.src,'http://localhost'),key=url.searchParams.get('key');if(!key)throw Error('Asset sem chave: '+source.name);const file=out+'/'+source.id+'-'+kind+'.png';let bytes;try{bytes=await readFile(file)}catch{const r=await s3.send(new GetObjectCommand({Bucket:url.searchParams.get('bucket')||cfg('WASABI_BUCKET'),Key:key}));bytes=Buffer.from(await r.Body.transformToByteArray());await writeFile(file,bytes)}let assetName=source.id+'-'+kind+'.png';if(kind==='seal'){bytes=await sharp(bytes).trim({threshold:10}).extend({top:3,bottom:3,left:3,right:3,background:'#00000000'}).png().toBuffer();assetName=source.id+'-seal-trimmed-v1.png';await writeFile(out+'/'+assetName,bytes)}result[kind]='catalog/'+assetName;result[kind+'Sha']=createHash('sha256').update(bytes).digest('hex');const meta=await sharp(bytes).metadata();result[kind+'Aspect']=meta.width/meta.height;if(kind==='background'){const st=await sharp(bytes).stats();result.color=st.dominant}}
 records.push(result);console.log(records.length,source.name)
}}));s3.destroy();await writeFile(root+'/assets.json',JSON.stringify(records,null,2))
