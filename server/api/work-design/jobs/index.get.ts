import { requireWorkPilot } from '../../../utils/work-design/access'
import { listWorkJobs, publicWorkJob, workDatabaseReady } from '../../../utils/work-design/repository'
export default defineEventHandler(async event => {
  const user = await requireWorkPilot(event)
  if (!await workDatabaseReady()) throw createError({ statusCode: 503, statusMessage: 'A fila experimental aguarda ativação no banco.' })
  return { jobs: (await listWorkJobs(user.id)).map(publicWorkJob) }
})
