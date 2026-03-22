import { randomUUID } from 'node:crypto'
import type { BuilderTenant } from '~/types/builder'
import { pgOneOrNull, pgQuery } from './postgres'

type TenantRow = BuilderTenant & {
  password_hash?: string | null
}

export const normalizeBuilderEmail = (email: unknown): string =>
  String(email || '').trim().toLowerCase()

export const getTenantByEmail = async (email: string): Promise<TenantRow | null> => {
  const normalized = normalizeBuilderEmail(email)
  if (!normalized) return null
  return pgOneOrNull<TenantRow>(
    `select *
     from public.builder_tenants
     where lower(email) = $1
     limit 1`,
    [normalized]
  )
}

export const getTenantById = async (id: string): Promise<TenantRow | null> => {
  const normalized = String(id || '').trim()
  if (!normalized) return null
  return pgOneOrNull<TenantRow>(
    `select *
     from public.builder_tenants
     where id = $1
     limit 1`,
    [normalized]
  )
}

export const createTenant = async (params: {
  name: string
  email: string
  passwordHash: string
}): Promise<TenantRow> => {
  const id = randomUUID()
  const normalizedEmail = normalizeBuilderEmail(params.email)
  const trimmedName = String(params.name || '').trim()

  const result = await pgQuery<TenantRow>(
    `insert into public.builder_tenants
       (id, email, name, password_hash)
     values
       ($1::uuid, $2, $3, $4)
     returning *`,
    [id, normalizedEmail, trimmedName, params.passwordHash]
  )

  const created = result.rows[0]
  if (!created) throw new Error('Failed to create builder tenant')
  return created
}

export const updateTenantLastLogin = async (tenantId: string): Promise<void> => {
  await pgQuery(
    `update public.builder_tenants
     set last_login_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
     where id = $1`,
    [tenantId]
  )
}

export const updateTenantProfile = async (
  tenantId: string,
  fields: Partial<Pick<BuilderTenant, 'name' | 'phone' | 'phone2' | 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'address' | 'payment_notes' | 'cep' | 'slogan' | 'logo' | 'logo_position' | 'slug' | 'segment1' | 'segment2' | 'segment3' | 'show_on_portal' | 'flyer_defaults'>>
): Promise<TenantRow | null> => {
  const allowedKeys = [
    'name', 'phone', 'phone2', 'whatsapp', 'instagram', 'facebook',
    'website', 'address', 'payment_notes', 'cep', 'slogan', 'logo',
    'logo_position', 'slug', 'segment1', 'segment2', 'segment3', 'show_on_portal',
    'flyer_defaults'
  ] as const

  const jsonbKeys = new Set(['logo_position', 'flyer_defaults'])

  const setClauses: string[] = []
  const values: any[] = []
  let paramIndex = 1

  for (const key of allowedKeys) {
    if (key in fields) {
      const value = (fields as any)[key]
      if (jsonbKeys.has(key)) {
        setClauses.push(`${key} = $${paramIndex}::jsonb`)
      } else if (key === 'show_on_portal') {
        setClauses.push(`${key} = $${paramIndex}::boolean`)
      } else {
        setClauses.push(`${key} = $${paramIndex}`)
      }
      values.push(jsonbKeys.has(key) ? JSON.stringify(value) : value)
      paramIndex++
    }
  }

  if (setClauses.length === 0) return getTenantById(tenantId)

  setClauses.push(`updated_at = timezone('utc', now())`)
  values.push(tenantId)

  return pgOneOrNull<TenantRow>(
    `update public.builder_tenants
     set ${setClauses.join(', ')}
     where id = $${paramIndex}
     returning *`,
    values
  )
}
