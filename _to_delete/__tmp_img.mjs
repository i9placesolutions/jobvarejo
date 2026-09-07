import fs from 'fs'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const s3=new S3Client({region:env.WASABI_REGION,endpoint:'https://'+env.WASABI_ENDPOINT,credentials:{accessKeyId:env.WASABI_ACCESS_KEY,secretAccessKey:env.WASABI_SECRET_KEY},forcePathStyle:true})
const key='imagens/1321f257f0d699ea-etiqueta-1.webp'
const r=await s3.send(new GetObjectCommand({Bucket:env.WASABI_BUCKET,Key:key}))
const buf=Buffer.concat(await r.Body.toArray())
console.log('bytes:',buf.length)
const img=sharp(buf)
const meta=await img.metadata()
console.log('meta:',meta.width,'x',meta.height,'ch',meta.channels,'hasAlpha',meta.hasAlpha,'format',meta.format)
// trim by alpha: get raw and compute alpha bbox with threshold 12
const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true})
const {width:W,height:H,channels:C}=info
let minX=W,minY=H,maxX=-1,maxY=-1
for(let y=0;y<H;y++){for(let x=0;x<W;x++){const a=data[(y*W+x)*C+3];if(a>12){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y}}}
if(maxX<minX){console.log('imagem totalmente transparente')}else{
  const bw=maxX-minX+1, bh=maxY-minY+1
  console.log('alpha bbox: left',minX,'top',minY,'w',bw,'h',bh)
  console.log('margem transparente: esq',minX,'dir',W-1-maxX,'topo',minY,'baixo',H-1-maxY)
  console.log('ocupacao:', (100*bw/W).toFixed(1)+'% largura,', (100*bh/H).toFixed(1)+'% altura')
}
