import { defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { authenticateWhatsAppService } from '~/server/utils/whatsapp-creation/access'
import { generateWhatsAppOrder } from '~/server/utils/whatsapp-creation/jobs'

export default defineEventHandler(async event => {
  authenticateWhatsAppService(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  const body = z.object({ orderId: z.string().uuid(), token: z.string().uuid() }).strict().parse(await readBody(event))
  const kind = z.enum(['encarte', 'video', 'cartaz', 'studio']).parse(getRouterParam(event, 'kind'))
  return generateWhatsAppOrder(body.orderId, body.token, kind, event)
})
