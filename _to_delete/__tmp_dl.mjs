import fs from 'fs'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const s3=new S3Client({region:env.WASABI_REGION,endpoint:'https://'+env.WASABI_ENDPOINT,credentials:{accessKeyId:env.WASABI_ACCESS_KEY,secretAccessKey:env.WASABI_SECRET_KEY},forcePathStyle:true})
const r=await s3.send(new GetObjectCommand({Bucket:env.WASABI_BUCKET,Key:'imagens/1321f257f0d699ea-etiqueta-1.webp'}))
const buf=Buffer.concat(await r.Body.toArray())
fs.writeFileSync('./__tmp_etiqueta.webp',buf)
console.log('salvo bytes:',buf.length)
