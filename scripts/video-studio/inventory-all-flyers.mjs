import pg from 'pg'
import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const user=process.env.VIDEO_TEST_USER_ID;if(!user)throw Error('Informe a conta de origem.')
const dir='output/video-all-models';await mkdir(dir,{recursive:true})
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:1})
const {rows}=await pool.query('SELECT id,name,user_id,canvas_data,template_config,updated_at FROM projects WHERE is_template=true AND user_id=$1 ORDER BY name,id',[user]);await pool.end()
await writeFile(dir+'/inventory.json',JSON.stringify(rows,null,2))
const cfg=n=>process.env[n]||process.env['NUXT_'+n]
const s3=new S3Client({endpoint:'https://'+cfg('WASABI_ENDPOINT').replace(/^https?:\/\//,''),region:cfg('WASABI_REGION'),credentials:{accessKeyId:cfg('WASABI_ACCESS_KEY'),secretAccessKey:cfg('WASABI_SECRET_KEY')}})
let cursor=0;const out=[]
await Promise.all(Array.from({length:5},async()=>{while(cursor<rows.length){const p=rows[cursor++];const page=p.canvas_data.find(p=>p.templateFormatId==='stories')||p.canvas_data.find(p=>p.width===1080&&p.height===1920)||p.canvas_data[0];try{
 let canvas=page.canvasData;if(!canvas){const r=await s3.send(new GetObjectCommand({Bucket:cfg('WASABI_BUCKET'),Key:page.canvasDataPath}));let b=Buffer.from(await r.Body.transformToByteArray());if(b[0]===31&&b[1]===139)b=gunzipSync(b);canvas=JSON.parse(b)}
 await writeFile(dir+'/'+p.id+'.json',JSON.stringify(canvas))
 out.push({id:p.id,name:p.name,page:page.id,width:page.width,height:page.height,images:canvas.objects.filter(o=>o.type?.toLowerCase()==='image').map(o=>({name:o.name,src:o.src,businessProfileField:o.businessProfileField,cropX:o.cropX,cropY:o.cropY,width:o.width,height:o.height})),texts:canvas.objects.filter(o=>o.text&&!o.businessProfileField).map(o=>({name:o.name,text:o.text}))})
 console.log(out.length+'/'+rows.length,p.name)
 }catch(e){out.push({id:p.id,name:p.name,error:String(e)})}}}))
s3.destroy();await writeFile(dir+'/sources.json',JSON.stringify(out,null,2));console.log('TOTAL',rows.length,'ERRORS',out.filter(x=>x.error).length)
