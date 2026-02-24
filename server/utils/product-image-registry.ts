import { createHash } from 'crypto'
import { pgOneOrNull, pgQuery } from './postgres'

export type ProductImageRegistryRow = {
  id: number
  product_code: string | null
  product_identity_key: string
  canonical_name: string | null
  brand: string | null
  flavor: string | null
  weight: string | null
  s3_key: string | null
  source: string | null
  validation_level: string | null
  validated_at: string | null
  validated_by: string | null
  status: 'approved' | 'review_pending' | 'rejected'
  reason: string | null
}

let registrySchemaReady = false
let registrySchemaInitPromise: Promise<boolean> | null = null
let registryDisabled = false

const isPgErrorCode = (err: any, code: string): boolean => String(err?.code || '').trim() === code
const isPermissionDeniedError = (err: any): boolean => {
  const message = String(err?.message || '').toLowerCase()
  return isPgErrorCode(err, '42501') || message.includes('permission denied')
}
const isRelationMissingError = (err: any): boolean =>
  isPgErrorCode(err, '42P01') || String(err?.message || '').toLowerCase().includes('does not exist')

const disableRegistry = (reason: string) => {
  if (registryDisabled) return
  registryDisabled = true
  console.warn(`⚠️ [Registry] Desabilitado nesta instância: ${reason}`)
}

export const ensureProductImageRegistrySchema = async (): Promise<boolean> => {
  if (registryDisabled) return false
  if (registrySchemaReady) return true
  if (registrySchemaInitPromise) return registrySchemaInitPromise

  registrySchemaInitPromise = (async () => {
    try {
      await pgQuery(
        `create table if not exists public.product_image_registry (
          id bigserial primary key,
          product_code text null,
          product_identity_key text not null,
          canonical_name text null,
          brand text null,
          flavor text null,
          weight text null,
          s3_key text null,
          source text null,
          validation_level text null,
          validated_at timestamptz null,
          validated_by text null,
          status text not null default 'review_pending'
            check (status in ('approved', 'review_pending', 'rejected')),
          reason text null,
          created_at timestamptz not null default timezone('utc', now()),
          updated_at timestamptz not null default timezone('utc', now())
        )`
      )

      await pgQuery(
        `create unique index if not exists product_image_registry_identity_key_uidx
           on public.product_image_registry (product_identity_key)`
      )
      await pgQuery(
        `create index if not exists product_image_registry_product_code_idx
           on public.product_image_registry (product_code)`
      )
      await pgQuery(
        `create index if not exists product_image_registry_status_updated_idx
           on public.product_image_registry (status, updated_at desc)`
      )

      registrySchemaReady = true
      return true
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        disableRegistry(String(err?.message || err || 'permission denied'))
        return false
      }
      throw err
    } finally {
      registrySchemaInitPromise = null
    }
  })()

  return registrySchemaInitPromise
}

const withRegistryTable = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  const ready = await ensureProductImageRegistrySchema()
  if (!ready) return fallback

  try {
    return await run()
  } catch (err: any) {
    if (isPermissionDeniedError(err)) {
      disableRegistry(String(err?.message || err || 'permission denied'))
      return fallback
    }
    if (isRelationMissingError(err)) {
      registrySchemaReady = false
      const recreated = await ensureProductImageRegistrySchema()
      if (!recreated) return fallback
      return await run()
    }
    throw err
  }
}

const normalizeText = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

export const buildProductIdentityKey = (opts: {
  productCode?: string | null
  normalizedTerm: string
  brand?: string
  flavor?: string
  weight?: string
}): string => {
  const code = normalizeText(String(opts.productCode || '')).replace(/[^a-z0-9]/g, '')
  if (code) return `code:${code}`

  const parts = [
    normalizeText(opts.normalizedTerm),
    normalizeText(String(opts.brand || '')),
    normalizeText(String(opts.flavor || '')),
    normalizeText(String(opts.weight || ''))
  ].filter(Boolean)
  const raw = parts.join('|')
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 24)
  return `meta:${hash}`
}

export const findRegistryApprovedImage = async (identityKey: string): Promise<ProductImageRegistryRow | null> => {
  return await withRegistryTable(
    () =>
      pgOneOrNull<ProductImageRegistryRow>(
        `select id, product_code, product_identity_key, canonical_name, brand, flavor, weight, s3_key, source,
                validation_level, validated_at, validated_by, status, reason
           from public.product_image_registry
          where product_identity_key = $1
            and status = 'approved'
            and s3_key is not null
          order by validated_at desc nulls last, id desc
          limit 1`,
        [identityKey]
      ),
    null
  )
}

export const upsertProductImageRegistry = async (opts: {
  productCode?: string | null
  identityKey: string
  canonicalName: string
  brand?: string
  flavor?: string
  weight?: string
  s3Key?: string | null
  source: string
  validationLevel: string
  validatedBy?: string | null
  status: 'approved' | 'review_pending' | 'rejected'
  reason?: string | null
}): Promise<void> => {
  await withRegistryTable(
    () =>
      pgQuery(
        `insert into public.product_image_registry
          (product_code, product_identity_key, canonical_name, brand, flavor, weight, s3_key, source, validation_level, validated_at, validated_by, status, reason, updated_at)
         values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, timezone('utc', now()), $10, $11, $12, timezone('utc', now()))
         on conflict (product_identity_key)
         do update set
          product_code = excluded.product_code,
          canonical_name = excluded.canonical_name,
          brand = excluded.brand,
          flavor = excluded.flavor,
          weight = excluded.weight,
          s3_key = excluded.s3_key,
          source = excluded.source,
          validation_level = excluded.validation_level,
          validated_at = excluded.validated_at,
          validated_by = excluded.validated_by,
          status = excluded.status,
          reason = excluded.reason,
          updated_at = timezone('utc', now())`,
        [
          opts.productCode ? String(opts.productCode).trim() : null,
          opts.identityKey,
          opts.canonicalName,
          opts.brand || null,
          opts.flavor || null,
          opts.weight || null,
          opts.s3Key || null,
          opts.source,
          opts.validationLevel,
          opts.validatedBy || null,
          opts.status,
          opts.reason || null
        ]
      ).then(() => undefined),
    undefined
  )
}
