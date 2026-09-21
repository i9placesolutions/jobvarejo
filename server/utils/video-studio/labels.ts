import { pgTx } from '../postgres'
import { adaptVideoLabel } from '../../../shared/video-studio/labels'
import { readVideoJsonParts } from '../../../shared/video-studio/read-json-parts'
export async function listVideoLabels(userId:string,labelId?:string){return pgTx(async client=>{
 await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'");await client.query("SET LOCAL statement_timeout='30s'")
 const rows:any[]=await readVideoJsonParts(client.query.bind(client),`SELECT coalesce(json_agg(t),'[]'::json) data FROM (SELECT DISTINCT ON (coalesce(template_key,id)) coalesce(template_key,id) id,name,"group" FROM public.label_templates WHERE (user_id=$1 OR user_id IS NULL) AND ($2::text IS NULL OR coalesce(template_key,id)=$2) ORDER BY coalesce(template_key,id),CASE WHEN user_id=$1 THEN 0 ELSE 1 END,updated_at DESC) t`,[userId,labelId||null])
 return rows.map(adaptVideoLabel).filter(Boolean)
})}
