import { z } from 'zod'
import { workRequestSchema } from '../../../../shared/work-design'
import { requireWorkPilot } from '../../../utils/work-design/access'
import { publicWorkJob, reviseWorkJob } from '../../../utils/work-design/repository'
export default defineEventHandler(async event => {
  const user = await requireWorkPilot(event)
  const id = z.string().uuid().safeParse(getRouterParam(event, 'id'))
  const body = z.object({ revision: z.number().int().positive(), request: workRequestSchema.nullable() }).strict().safeParse(await readBody(event))
  if (!id.success || !body.success) throw createError({ statusCode: 400, statusMessage: 'Pedido ou revisão inválidos.' })
  return publicWorkJob(await reviseWorkJob(user.id, id.data, body.data.revision, body.data.request))
})
