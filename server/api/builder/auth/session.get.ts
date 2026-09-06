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
      logo_position: tenant.logo_position ?? {},
      phone: tenant.phone ?? null,
      phone2: tenant.phone2 ?? null,
      whatsapp: tenant.whatsapp ?? null,
      address: tenant.address ?? null,
      instagram: tenant.instagram ?? null,
      facebook: tenant.facebook ?? null,
      website: tenant.website ?? null,
      slogan: tenant.slogan ?? null,
      cep: tenant.cep ?? null,
      payment_notes: tenant.payment_notes ?? null,
      segment1: tenant.segment1 ?? null,
      segment2: tenant.segment2 ?? null,
      segment3: tenant.segment3 ?? null,
      flyer_defaults: tenant.flyer_defaults ?? null,
      plan: tenant.plan ?? 'free',
    }
  }
})
