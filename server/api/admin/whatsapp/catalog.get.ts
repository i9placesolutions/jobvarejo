import { requireAdminUser } from '../../../utils/auth'
import { whatsappOperations, whatsappApiVersion, whatsappSuperAdminOperations } from '../../../utils/whatsapp-admin'
export default defineEventHandler(async event => {
  const { role } = await requireAdminUser(event)
  const adminToken = Boolean(process.env.JOBVAREJO_UAZAPI_ADMIN_TOKEN)
  return { version: whatsappApiVersion, operations: whatsappOperations.map(operation => ({ ...operation,
    available: operation.id !== 'subscribeSSE' && (!whatsappSuperAdminOperations.has(operation.id) || role === 'super_admin') && (!operation.adminTokenRequired || (role === 'super_admin' && adminToken)),
    disabledReason: whatsappSuperAdminOperations.has(operation.id) && role !== 'super_admin' ? 'Exige super administrador para alterar a integração.' : operation.id === 'subscribeSSE' ? 'Conexão gerenciada automaticamente pelo chat.' : operation.adminTokenRequired && (role !== 'super_admin' || !adminToken) ? 'Exige super administrador e credencial administrativa UAZAPI.' : undefined
  })) }
})
