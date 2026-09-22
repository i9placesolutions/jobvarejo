import { z } from 'zod'
import { VIDEO_THEMES } from '../../../../shared/video-studio/model'
import { newVideoFromTemplate } from '../../../../shared/video-studio/templates'
import { loadVideoBrand } from '../../../utils/video-studio/brand'
import { videoUser, videoJson } from '../../../utils/video-studio/service'
import { pgOneOrNull } from '../../../utils/postgres'

export default defineEventHandler(async event => {
  const user = await videoUser(event, 15)
  const input = z.object({theme:z.string().refine(id=>VIDEO_THEMES.some(t=>t.id===id))}).safeParse(await readBody(event))
  if (!input.success) throw createError({statusCode:422,statusMessage:'Escolha um modelo disponível.'})
  // Somente a receita compartilhada é copiada. Nenhum ID, mídia privada,
  // contato, oferta ou áudio de um projeto de demonstração é herdado.
  const document = newVideoFromTemplate(input.data.theme)
  const {brand,warning} = await loadVideoBrand(user.id)
  document.brand = {...brand,logoStyle:'sticker'}
  document.title = `${document.campaign} — meu vídeo`.slice(0,100)
  const project = await pgOneOrNull('INSERT INTO public.video_studio_projects(user_id,title,document,script_source) VALUES($1,$2,$3::jsonb,$4) RETURNING *', [user.id,document.title,videoJson(document),''])
  return {project,warning}
})
