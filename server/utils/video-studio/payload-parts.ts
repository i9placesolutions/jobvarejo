import type {PoolClient} from 'pg'
// Keep packets bounded on the video database connection. This table is private
// to the transaction and disappears on commit or rollback.
export async function stageVideoPayload(client:PoolClient, json:string){
 await client.query('CREATE TEMP TABLE video_job_payload_parts (ordinal integer PRIMARY KEY, part text NOT NULL) ON COMMIT DROP')
 let part='',bytes=0,ordinal=0
 const flush=async()=>{if(part){await client.query('INSERT INTO pg_temp.video_job_payload_parts(ordinal,part) VALUES($1,$2)',[ordinal++,part]);part='';bytes=0}}
 for(const char of json){const size=Buffer.byteLength(char);if(bytes+size>650)await flush();part+=char;bytes+=size}
 await flush()
}
