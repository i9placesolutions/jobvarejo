import { pgOneOrNull, pgQuery } from './postgres'

export type ProductImageCacheInput = {
  searchTerm: string
  productName: string
  brand?: string
  flavor?: string
  weight?: string
  imageUrl: string
  s3Key?: string
  source: string
  userId?: string
}

export type ProductImageCacheHit = {
  id?: string | number
  image_url?: string | null
  s3_key?: string | null
  resolved_s3_key?: string | null
  source?: string | null
}

type ProductImageCacheLookupOptions = {
  bucketName?: string
  endpoint?: string
}

const resolveWasabiKeyFromUrl = (rawUrl: string, bucketName: string, endpoint: string): string | null => {
  const value = String(rawUrl || '').trim()
  if (!value) return null
  const valueNoQuery = value.split('?')[0]?.split('#')[0]?.trim() || value

  const directKeyPrefixes = ['imagens/', 'uploads/', 'logo/', 'projects/']
  if (directKeyPrefixes.some((prefix) => valueNoQuery.startsWith(prefix))) return valueNoQuery

  if (/^[^/]+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(valueNoQuery)) {
    return valueNoQuery
  }

  if (value.startsWith('/api/storage/proxy?') || value.startsWith('/api/storage/p?')) {
    try {
      const parsed = new URL(value, 'http://local')
      const key = parsed.searchParams.get('key')
      return key ? decodeURIComponent(key) : null
    } catch {
      return null
    }
  }

  if (!(value.startsWith('http://') || value.startsWith('https://'))) return null
  try {
    const parsed = new URL(value)
    const host = parsed.host.toLowerCase()
    const pathParts = decodeURIComponent(parsed.pathname || '').split('/').filter(Boolean)

    const hostLooksLikeStorage =
      (endpoint && host.includes(endpoint.toLowerCase())) ||
      host.includes('wasabisys.com')
    if (!hostLooksLikeStorage || pathParts.length === 0) return null

    if (bucketName && pathParts[0] === bucketName && pathParts.length > 1) {
      return pathParts.slice(1).join('/')
    }
    if (bucketName && host.startsWith(`${bucketName.toLowerCase()}.`) && pathParts.length > 0) {
      return pathParts.join('/')
    }
    if (directKeyPrefixes.some((prefix) => pathParts[0]?.startsWith(prefix.replace('/', '')))) {
      return pathParts.join('/')
    }
  } catch {
    return null
  }

  return null
}

export async function saveProductImageCache(opts: ProductImageCacheInput, retries = 1): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await pgQuery(
        `insert into public.product_image_cache
          (search_term, product_name, brand, flavor, weight, image_url, s3_key, source, user_id, usage_count)
         values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (search_term) do update
         set product_name = excluded.product_name,
             brand = excluded.brand,
             flavor = excluded.flavor,
             weight = excluded.weight,
             image_url = excluded.image_url,
             s3_key = excluded.s3_key,
             source = excluded.source,
             user_id = excluded.user_id,
             usage_count = excluded.usage_count,
             updated_at = timezone('utc', now())`,
        [
          opts.searchTerm,
          opts.productName,
          opts.brand || null,
          opts.flavor || null,
          opts.weight || null,
          opts.imageUrl,
          opts.s3Key || null,
          opts.source,
          opts.userId || null,
          1
        ]
      )

      console.log(`💾 [Cache DB] Salvo: "${opts.productName}" (${opts.source})`)
      return true
    } catch (err) {
      if (attempt < retries) {
        console.warn(`⚠️ [Cache DB] Tentativa ${attempt + 1} falhou, retentando...`)
        await new Promise((resolve) => setTimeout(resolve, 500))
      } else {
        console.warn('⚠️ [Cache DB] Falha ao salvar no cache após retries:', (err as any)?.message)
      }
    }
  }
  return false
}

export async function findProductImageCacheHitByTerms(
  normalizedTerms: string[],
  options: ProductImageCacheLookupOptions = {}
): Promise<ProductImageCacheHit | null> {
  const bucketName = String(options.bucketName || '').trim()
  const endpoint = String(options.endpoint || '').trim()
  for (const candidate of normalizedTerms) {
    const row = await pgOneOrNull<ProductImageCacheHit>(
      `select id, image_url, s3_key, source
       from public.product_image_cache
       where search_term = $1
       order by usage_count desc nulls last
       limit 1`,
      [candidate]
    )

    if (!row) continue
    const directKey = String(row.s3_key || '').trim()
    if (directKey) return { ...row, resolved_s3_key: directKey }

    const resolvedFromUrl = resolveWasabiKeyFromUrl(String(row.image_url || ''), bucketName, endpoint)
    if (resolvedFromUrl) return { ...row, resolved_s3_key: resolvedFromUrl }
    if (row.image_url) return row
  }
  return null
}

export async function incrementProductImageCacheUsage(rowId: string | number | null | undefined): Promise<void> {
  if (rowId === null || rowId === undefined) return
  try {
    await pgQuery(
      `update public.product_image_cache
       set usage_count = coalesce(usage_count, 0) + 1
       where id = $1::uuid`,
      [String(rowId)]
    )
  } catch (error: any) {
    console.warn('⚠️ [Cache DB] Falha ao incrementar usage_count:', error?.message || String(error))
  }
}
