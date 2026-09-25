import { requireAuthenticatedUser } from '../../utils/auth'
import { assertEnhancementProject, readEnhancement, publicReceipt } from '../../utils/page-enhancement'
export default defineEventHandler(async event=>{const user=await requireAuthenticatedUser(event);const q=getQuery(event);const projectId=String(q.projectId||'');await assertEnhancementProject(user.id,projectId);const r=await readEnhancement(user.id,projectId,String(q.id||''));if(!r)throw createError({statusCode:404,statusMessage:'Teste não encontrado.'});return publicReceipt(r)})
