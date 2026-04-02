import { enforceRateLimit } from '../../../utils/rate-limit'
import { requireBuilderTenant } from '../../../utils/builder-auth'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  await enforceRateLimit(event, `builder-session:${tenant.id}`, 300, 60_000)

  return {
    tenant: {
      id: tenant.id,
      email: tenant.email,
      name: tenant.name ?? null,
      logo: tenant.logo ?? null,
      phone: tenant.phone ?? null,
      whatsapp: tenant.whatsapp ?? null,
      address: tenant.address ?? null,
      instagram: tenant.instagram ?? null,
      facebook: tenant.facebook ?? null,
      website: tenant.website ?? null,
      slogan: tenant.slogan ?? null,
      cep: tenant.cep ?? null,
    }
  }
})
