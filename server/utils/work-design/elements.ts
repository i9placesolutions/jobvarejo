import { createHash } from 'node:crypto'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import { z } from 'zod'
import { workElementMetadataSchema, keySchema, type WorkElementMetadata } from '../../../shared/work-design'
import elements from '../../data/work-design-elements.json'
import { getS3Client } from '../s3'
import { assertWorkImageKey, readWorkBytes, writeWorkBytes, workBucket } from './storage'

const entrySchema = workElementMetadataSchema.extend({ id: z.string(), ownerId: z.string().uuid(), key: keySchema,
  width: z.number().positive().optional(), height: z.number().positive().optional(), createdAt: z.string().optional() })
export type WorkElement = z.infer<typeof entrySchema>
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const themeFolder = (theme: string) => digest(theme.trim().toLocaleLowerCase('pt-BR'))
const catalogPrefix = (owner: string) => `projects/${owner}/work-elements/`
const cache = new Map<string, { until: number; entries: WorkElement[] }>()

/** Um registro por peça: gravações simultâneas não sobrescrevem uma lista central. */
export async function saveWorkElement(owner: string, asset: { key: string; width?: number; height?: number }, metadata: WorkElementMetadata) {
  assertWorkImageKey(asset.key, owner)
  if (!asset.key.startsWith(`projects/${owner}/work-assets/`))
    throw createError({ statusCode: 403, statusMessage: 'A peça gerada precisa pertencer à conta.' })
  const parsed = workElementMetadataSchema.parse(metadata)
  const id = digest(`${asset.key}:${parsed.role}:${themeFolder(parsed.theme)}`)
  const entry = entrySchema.parse({ ...parsed, ...asset, id, ownerId: owner, createdAt: new Date().toISOString() })
  const key = `${catalogPrefix(owner)}${parsed.role}/${themeFolder(parsed.theme)}/${id}.json`
  await writeWorkBytes(key, Buffer.from(JSON.stringify(entry)), 'application/json')
  for (const cacheKey of cache.keys()) if (cacheKey.startsWith(`${owner}|`)) cache.delete(cacheKey)
  return entry
}

export async function listWorkElements(owner: string, role?: WorkElementMetadata['role'], theme?: string): Promise<WorkElement[]> {
  const prefix = `${catalogPrefix(owner)}${role ? `${role}/` : ''}${role && theme ? `${themeFolder(theme)}/` : ''}`
  const cacheKey = `${owner}|${prefix}`, cached = cache.get(cacheKey)
  if (cached && cached.until > Date.now()) return structuredClone(cached.entries)
  const seeded = elements.filter(e => e.ownerId === owner && (!role || e.role === role)).map(e => entrySchema.parse(e))
  const keys: string[] = [], seenTokens = new Set<string>()
  let token: string | undefined
  do {
    const page = await getS3Client().send(new ListObjectsV2Command({ Bucket: workBucket(), Prefix: prefix, MaxKeys: 1000,
      ...(token ? { ContinuationToken: token } : {}) }))
    keys.push(...(page.Contents || []).map(o => o.Key || '').filter(k => k.startsWith(prefix) && k.endsWith('.json')))
    token = page.IsTruncated ? page.NextContinuationToken : undefined
    if (token && seenTokens.has(token)) throw createError({ statusCode: 502, statusMessage: 'Não foi possível percorrer a biblioteca.' })
    if (token) seenTokens.add(token)
  } while (token)
  const entries = [...seeded]
  for (let i = 0; i < keys.length; i += 8) {
    const batch = await Promise.all(keys.slice(i, i + 8).map(async key => {
      const entry = entrySchema.parse(JSON.parse((await readWorkBytes(key)).toString('utf8')))
      if (entry.ownerId !== owner || (role && entry.role !== role))
        throw createError({ statusCode: 403, statusMessage: 'Peça fora do escopo da biblioteca.' })
      assertWorkImageKey(entry.key, owner)
      return entry
    }))
    entries.push(...batch)
  }
  const unique = [...new Map(entries.map(e => [`${e.key}:${e.role}`, e])).values()]
  if (cache.size >= 100) cache.delete(cache.keys().next().value!)
  cache.set(cacheKey, { until: Date.now() + 30_000, entries: unique })
  return structuredClone(unique)
}

export const workSeals = (owner: string) => listWorkElements(owner, 'seal')
export async function assertWorkSeal(owner: string, key?: string) {
  if (!key || elements.some(e => e.ownerId === owner && e.role === 'seal' && e.key === key)) return
  assertWorkImageKey(key, owner)
  if (!(await workSeals(owner)).some(e => e.key === key))
    throw createError({ statusCode: 422, statusMessage: 'Selo de campanha indisponível para esta conta.' })
}
