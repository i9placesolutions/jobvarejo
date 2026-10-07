import { z } from 'zod'
import { workRequestSchema } from '../../../../shared/work-design'
import { requireWorkConsumer } from '../../../utils/work-design/access'
import { createWorkJob, publicWorkJob, workDatabaseReady } from '../../../utils/work-design/repository'
export default defineEventHandler(async event => {
  const owner = await requireWorkConsumer(event, 'n8n')
  if (!await workDatabaseReady()) throw createError({ statusCode: 503, statusMessage: 'Fila experimental ainda não ativada.' })
  const body = z.object({ request: workRequestSchema, idempotencyKey: z.string().uuid() }).strict().safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, statusMessage: 'Envie request e idempotencyKey conforme o contrato.' })
  return publicWorkJob(await createWorkJob(owner, body.data.request, body.data.idempotencyKey))
})
