import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const env = name => process.env[name] || process.env[`NUXT_${name}`]
const client = new S3Client({ endpoint: `https://${env('WASABI_ENDPOINT').replace(/^https?:\/\//, '')}`, region: env('WASABI_REGION') || 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: env('WASABI_ACCESS_KEY'), secretAccessKey: env('WASABI_SECRET_KEY') } })
const Bucket = env('WASABI_BUCKET') || 'jobvarejo'
let verified = 0
const files = (await readdir('public/cartoes')).filter(f => /^cartao-\d+\.png$/.test(f))
for (let i = 0; i < files.length; i += 6) await Promise.all(files.slice(i, i + 6).map(async file => {
 const Body = await readFile(`public/cartoes/${file}`)
 const Key = `uploads/payment-cards/v1/${file}`
 await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType: 'image/png' }))
 const result = await client.send(new GetObjectCommand({ Bucket, Key }))
 const downloaded = await result.Body.transformToByteArray()
 const hash = data => createHash('sha256').update(data).digest('hex')
 if (hash(Body) !== hash(downloaded)) throw new Error(`Verificação falhou: ${file}`)
 verified++
}))
console.log(`${verified} bandeiras individuais enviadas e verificadas no Wasabi.`)
client.destroy()
