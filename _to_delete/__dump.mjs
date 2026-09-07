import fs from 'fs'
import pg from 'pg'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const c=new pg.Client({connectionString:env.POSTGRES_DATABASE_URL||env.DATABASE_URL,ssl:false,connectionTimeoutMillis:8000})
await c.connect()
const r=await c.query(`select "group" g from public.label_templates where id='j6ddxpj41'`)
fs.writeFileSync('_to_delete/group.json', JSON.stringify(r.rows[0].g))
console.log('escrito', fs.statSync('_to_delete/group.json').size, 'bytes')
await c.end()
