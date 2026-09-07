import fs from 'fs'
import pg from 'pg'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const url = env.POSTGRES_DATABASE_URL || env.DATABASE_URL
const c = new pg.Client({ connectionString: url, ssl:false, connectionTimeoutMillis: 8000 })
await c.connect()
const r = await c.query(`select "group" g, preview_data_url pv from public.label_templates where id='j6ddxpj41'`)
const g = r.rows[0].g
console.log('preview_data_url prefix:', String(r.rows[0].pv||'').slice(0,40), 'len', String(r.rows[0].pv||'').length)
const find=(o,n)=>{ if(!o)return null; if(o.name===n)return o; for(const ch of (o.objects||[])){const f=find(ch,n); if(f)return f} return null }
const s=find(g,'splash_image')
console.log('splash_image keys:', Object.keys(s).join(','))
console.log('src:', s.src)
console.log('crossOrigin:', s.crossOrigin, 'cropX:',s.cropX,'cropY:',s.cropY,'w:',s.width,'h:',s.height,'sx:',s.scaleX,'clipPath:',!!s.clipPath)
await c.end()
