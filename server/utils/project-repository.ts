import { pgOneOrNull } from './postgres'
import { stringifyJsonbParam } from './jsonb'

export type ProjectStorageRow = {
  id: string
  user_id: string
  canvas_data: any
}

export const getOwnedProjectStorageRow = async (
  projectId: string,
  userId: string
): Promise<ProjectStorageRow | null> => {
  return pgOneOrNull<ProjectStorageRow>(
    `select id, user_id, canvas_data
     from public.projects
     where id = $1
       and user_id = $2
     limit 1`,
    [projectId, userId]
  )
}

export const updateOwnedProjectCanvasData = async (
  projectId: string,
  userId: string,
  canvasData: any
): Promise<boolean> => {
  const canvasDataJson = stringifyJsonbParam(canvasData)
  const row = await pgOneOrNull<{ id: string }>(
    `update public.projects
     set canvas_data = $1::jsonb,
         updated_at = timezone('utc', now())
     where id = $2
       and user_id = $3
     returning id`,
    [canvasDataJson, projectId, userId]
  )

  return Boolean(row?.id)
}
