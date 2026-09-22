import { videoUser, videoJson, validateVideoAssets, ownedVideo } from '../../../utils/video-studio/service'
import { isVideoModel, VIDEO_MODEL_TITLE_PATTERN } from '../../../../shared/video-studio/project-kind'
import { videoSaveSchema } from '../../../utils/video-studio/schema'
import { pgOneOrNull } from '../../../utils/postgres'
export default defineEventHandler(async event=>{const user=await videoUser(event,60);const parsed=videoSaveSchema.safeParse(await readBody(event));if(!parsed.success)throw createError({statusCode:422,statusMessage:'Confira os campos do vídeo.'});const data=parsed.data;await validateVideoAssets(data.document,user.id)
 if(data.id){
 const current=await ownedVideo(data.id,user.id)
 if(isVideoModel(current))throw createError({statusCode:409,statusMessage:'Este é um modelo. Crie sua cópia antes de editar.'})
 const row=await pgOneOrNull<any>("UPDATE public.video_studio_projects SET title=$1,document=$2::jsonb,script_source=$3,revision=revision+1,updated_at=now() WHERE id=$4 AND user_id=$5 AND revision=$6 AND title !~* $7 RETURNING *",[data.document.title,videoJson(data.document),data.scriptSource,data.id,user.id,data.revision,VIDEO_MODEL_TITLE_PATTERN]);if(!row)throw createError({statusCode:409,statusMessage:'Este vídeo mudou em outra janela. Reabra antes de salvar.'});return row}
 return await pgOneOrNull('INSERT INTO public.video_studio_projects(user_id,title,document,script_source) VALUES($1,$2,$3::jsonb,$4) RETURNING *',[user.id,data.document.title,videoJson(data.document),data.scriptSource])
})
