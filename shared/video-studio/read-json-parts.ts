// Bounded rows for video payloads on connections that stall on a large result row.
// The caller must supply a consistent transaction for mutable records.
const VIDEO_JSON_PART_CHARS=1000
const VIDEO_JSON_MAX_CHARS=16_000_000
export async function readVideoJsonParts(query: (sql:string, values:any[])=>Promise<any>, sql:string, values:any[]) {
 const result=await query(`
  SELECT
   substring(video_data.data::text,chunks.start_at,${VIDEO_JSON_PART_CHARS}) AS part,
   char_length(video_data.data::text)::int AS total_chars
  FROM (${sql}) video_data
  CROSS JOIN LATERAL generate_series(
   1,
   LEAST(char_length(video_data.data::text),${VIDEO_JSON_MAX_CHARS}),
   ${VIDEO_JSON_PART_CHARS}
  ) AS chunks(start_at)
  ORDER BY chunks.start_at
 `,values)
 if(!result.rows.length)return null
 const totalChars=Number(result.rows[0]?.total_chars||0)
 if(totalChars>VIDEO_JSON_MAX_CHARS)throw Error('Dados do vídeo excedem o limite de leitura.')
 return JSON.parse(result.rows.map((row:any)=>String(row.part||'')).join(''))
}
