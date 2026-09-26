import { pgOneOrNull } from './postgres'
import { getProjectOwnerIdFromKey, isProjectsKey } from './storage-scope'

// A biblioteca de encartes é publicada a todos os usuários autenticados.
// Somente leituras dentro do projeto de um modelo administrativo são liberadas.
export async function isTemplateLibraryStorageKey(key: string): Promise<boolean> {
  if (!isProjectsKey(key)) return false
  const parts = key.split('/')
  const ownerId = getProjectOwnerIdFromKey(key)
  const projectId = parts[2]
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!ownerId || !projectId || !uuid.test(ownerId) || !uuid.test(projectId) || parts.length < 4) return false
  const row = await pgOneOrNull<{ id: string }>(`
    SELECT project.id
      FROM public.projects project
      JOIN public.profiles owner ON owner.id = project.user_id
     WHERE project.id = $1
       AND project.user_id = $2
       AND project.is_template = true
       AND owner.role IN ('super_admin', 'admin')
     LIMIT 1
  `, [projectId, ownerId])
  return Boolean(row?.id)
}
