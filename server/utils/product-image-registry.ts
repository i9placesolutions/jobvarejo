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
  return await pgOneOrNull<ProductImageRegistryRow>(
    `select id, product_code, product_identity_key, canonical_name, brand, flavor, weight, s3_key, source,
            validation_level, validated_at, validated_by, status, reason
       from public.product_image_registry
      where product_identity_key = $1
        and status = 'approved'
        and s3_key is not null
      order by validated_at desc nulls last, id desc
      limit 1`,
    [identityKey]
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
  await pgQuery(
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
  )
}
