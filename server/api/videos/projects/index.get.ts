import { videoUser } from '../../../utils/video-studio/service'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async event=>{
 const user=await videoUser(event)
 const libraryView=String(getQuery(event).view||'')==='library'
 const projectProjection=libraryView
  ? `jsonb_build_object(
      'theme',p.document->'theme',
      'brand',jsonb_build_object('name',coalesce(p.document#>>'{brand,name}','')),
      'campaign',p.document->'campaign',
      'duration',p.document->'duration',
      'offerCount',jsonb_array_length(coalesce(p.document->'offers','[]'::jsonb))
     ) AS summary`
  : 'p.document'
 const responseProjection=libraryView?'p.summary':'p.document'
 try{
  const {rows}=await pgQuery(`
   WITH visible_projects AS (
    SELECT p.id,p.user_id,p.title,p.revision,p.updated_at,${projectProjection}
    FROM public.video_studio_projects p
    WHERE p.user_id=$1
    ORDER BY p.updated_at DESC
    LIMIT 500
   ), covers AS (
    SELECT DISTINCT ON (j.project_id)
     j.project_id,
     output->>'coverAssetId' AS asset_id,
     output->>'format' AS format
    FROM public.video_studio_jobs j
    JOIN visible_projects p ON p.id=j.project_id AND p.user_id=j.user_id AND p.revision=j.revision
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(j.result->'outputs','[]'::jsonb)) output
    WHERE j.user_id=$1
     AND j.kind='render'
     AND j.status='ready'
     AND coalesce(output->>'coverAssetId','')<>''
    ORDER BY j.project_id,CASE WHEN output->>'format'='horizontal' THEN 0 ELSE 1 END,j.updated_at DESC
   )
   SELECT p.id,p.title,p.revision,p.updated_at,${responseProjection},cover.asset_id AS "coverAssetId",cover.format AS "coverFormat"
   FROM visible_projects p
   LEFT JOIN covers cover ON cover.project_id=p.id
   ORDER BY p.updated_at DESC
  `,[user.id])
  return {items:rows}
 }catch(e:any){
  if(e.code==='42P01')throw createError({statusCode:503,statusMessage:'A área de vídeos está aguardando a preparação do servidor.'})
  throw e
 }
})
