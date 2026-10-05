import { requireAdminUser } from '../../../utils/auth'
import { callWhatsApp, whatsappAdminConfig } from '../../../utils/whatsapp-admin'
export default defineEventHandler(async event => {
  await requireAdminUser(event)
  try { whatsappAdminConfig() } catch { return { configured: false, error: 'A instância JobVarejo precisa ser configurada no servidor.' } }
  try { return { configured: true, instance: await callWhatsApp('getInstanceStatus') } }
  catch (error: any) { return { configured: true, error: error.statusMessage || 'Instância indisponível.' } }
})
