import { requireAuthenticatedUser } from '../../utils/auth'
import { assertEnhancementProject, listEnhancements } from '../../utils/page-enhancement'
export default defineEventHandler(async event=>{const user=await requireAuthenticatedUser(event);const projectId=String(getQuery(event).projectId||'');await assertEnhancementProject(user.id,projectId);return {items:await listEnhancements(user.id,projectId)}})
