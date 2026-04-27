import { pgQuery } from './postgres'
import { normalizeSearchTerm } from './product-image-matching'

const userAssetNamesMemo = new Map<string, { expiresAt: number; data: Map<string, string> }>()

export const getUserAssetNamesMap = async (userId: string): Promise<Map<string, string>> => {
  const cacheKey = String(userId || '').trim()
  if (!cacheKey) return new Map()

  const cached = userAssetNamesMemo.get(cacheKey)
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.data

  const next = new Map<string, string>()
  try {
    const { rows } = await pgQuery<{ asset_key: string; display_name: string }>(
      `select asset_key, display_name
       from public.asset_names
       where user_id = $1`,
      [cacheKey]
    )

    for (const row of rows || []) {
      const key = String(row?.asset_key || '').trim()
      const displayName = String(row?.display_name || '').trim()
      if (!key || !displayName) continue
      next.set(key, displayName)
    }
  } catch {
    // asset_names is optional in older installs; keep image search resilient.
  }

  userAssetNamesMemo.set(cacheKey, { expiresAt: now + 60_000, data: next })
  if (userAssetNamesMemo.size > 500) {
    const oldestKey = userAssetNamesMemo.keys().next().value
    if (oldestKey) userAssetNamesMemo.delete(oldestKey)
  }

  return next
}

export const findExactAssetNameKey = (
  normalizedCandidates: string[],
  assetNamesByKey: Map<string, string>
): string | null => {
  if (!assetNamesByKey || assetNamesByKey.size === 0) return null

  const candidateOrder = new Map<string, number>()
  const candidateSet = new Set<string>()
  normalizedCandidates
    .map((value) => normalizeSearchTerm(value))
    .filter(Boolean)
    .forEach((value, idx) => {
      if (!candidateSet.has(value)) candidateOrder.set(value, idx)
      candidateSet.add(value)
    })

  if (candidateSet.size === 0) return null

  let best: { key: string; score: number } | null = null
  for (const [key, displayName] of assetNamesByKey.entries()) {
    const normalizedDisplayName = normalizeSearchTerm(displayName)
    if (!normalizedDisplayName || !candidateSet.has(normalizedDisplayName)) continue

    const tokenCount = normalizedDisplayName.split(' ').filter(Boolean).length
    const candidateRank = Number(candidateOrder.get(normalizedDisplayName) ?? 999)
    const prefixBoost = key.startsWith('uploads/')
      ? 0.4
      : (key.startsWith('imagens/') ? 0.2 : 0)
    const score =
      (tokenCount * 10) +
      (normalizedDisplayName.length * 0.01) +
      prefixBoost -
      (candidateRank * 0.001)

    if (!best || score > best.score) best = { key, score }
  }

  return best?.key || null
}
