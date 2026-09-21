// Bounded responses for video assets on connections that stall on large result rows.
// The caller must supply a consistent transaction for mutable records.
export async function readVideoJsonParts(query: (sql:string, values:any[])=>Promise<any>, sql:string, values:any[]) {
 let text=''
 for(let offset=1;offset<=16_000_000;offset+=1000){
  const result=await query(`SELECT substring(data::text,$${values.length+1}::int,1000) AS part FROM (${sql}) video_data`,[...values,offset])
  const part=result.rows[0]?.part
  if(part==null)return null
  text+=part
  if(part.length<1000)return JSON.parse(text)
 }
 throw Error('Dados do vídeo excedem o limite de leitura.')
}
