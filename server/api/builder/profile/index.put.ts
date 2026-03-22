import { requireBuilderTenant } from '../../../utils/builder-auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { updateTenantProfile } from '../../../utils/builder-auth-db'

export default defineEventHandler(async (event) => {
  const tenant = await requireBuilderTenant(event)
  enforceRateLimit(event, `builder-profile-update:${tenant.id}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)

  const allowedKeys = [
    'name', 'phone', 'phone2', 'whatsapp', 'instagram', 'facebook',
    'website', 'address', 'payment_notes', 'cep', 'slogan', 'logo',
    'segment1', 'segment2', 'segment3', 'show_on_portal', 'flyer_defaults'
  ] as const

  const fields: Record<string, any> = {}
  for (const key of allowedKeys) {
    if (key in body) {
      fields[key] = body[key]
    }
  }

  if (Object.keys(fields).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  const updated = await updateTenantProfile(tenant.id, fields)

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })
  }

  return {
    tenant: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      logo: updated.logo ?? null,
      phone: updated.phone ?? null,
      phone2: updated.phone2 ?? null,
      whatsapp: updated.whatsapp ?? null,
      instagram: updated.instagram ?? null,
      facebook: updated.facebook ?? null,
      website: updated.website ?? null,
      address: updated.address ?? null,
      payment_notes: updated.payment_notes ?? null,
      cep: updated.cep ?? null,
      slogan: updated.slogan ?? null,
      segment1: updated.segment1 ?? null,
      segment2: updated.segment2 ?? null,
      segment3: updated.segment3 ?? null,
      show_on_portal: updated.show_on_portal ?? false,
      flyer_defaults: updated.flyer_defaults ?? null
    }
  }
})
