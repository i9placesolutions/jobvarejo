import { z } from 'zod'
import { requireWorkConsumer } from '../../../../utils/work-design/access'
import { getWorkJob, publicWorkJob } from '../../../../utils/work-design/repository'
export default defineEventHandler(async event => {
  const owner = await requireWorkConsumer(event, 'n8n')
  const id = z.string().uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Pedido inválido.' })
  const job = publicWorkJob(await getWorkJob(owner, id.data))
  return { id: job.id, revision: job.revision, status: job.status, result: job.result, error: job.error }
})
