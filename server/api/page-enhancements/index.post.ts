import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { startEnhancement, publicReceipt } from '../../utils/page-enhancement'
export default defineEventHandler(async event => {
  const user=await requireAuthenticatedUser(event)
  await enforceRateLimit(event,`page-enhance:${user.id}`,8,60_000)
  const length=Number(getHeader(event,'content-length')||0)
  if(length>75_000_000)throw createError({statusCode:413,statusMessage:'Página muito grande.'})
  const {receipt,run}=await startEnhancement(user.id,await readBody(event))
  if(run){const task=run();event.waitUntil(task)}
  return publicReceipt(receipt)
})
