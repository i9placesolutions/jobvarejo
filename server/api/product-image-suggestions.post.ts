import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { searchChromiumImageCandidates } from '../utils/product-image-chromium'

/** Busca explícita de alternativas, sem escolher, processar ou salvar imagem. */
export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event)
    await enforceRateLimit(event, `product-image-suggestions:${user.id}`, 8, 60_000)
    const body = await readBody<Record<string, unknown>>(event)
    const term = String(body?.term || '').trim()
    if (term.length < 2 || term.length > 180) {
        throw createError({ statusCode: 400, statusMessage: 'Informe um produto com 2 a 180 caracteres.' })
    }
    const result = await searchChromiumImageCandidates(term)
    if (result.error && !result.candidates.length) {
        throw createError({ statusCode: 502, statusMessage: 'Não foi possível buscar mais imagens. Tente novamente.' })
    }
    const seen = new Set<string>()
    const candidates = result.candidates.flatMap((candidate, index) => {
        try {
            const url = new URL(String(candidate?.url || ''))
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || seen.has(url.href)) return []
            seen.add(url.href)
            return [{
                id: `chromium-${index}`,
                url: url.href,
                previewUrl: url.href,
                title: String(candidate.title || term).slice(0, 300),
                domain: url.hostname,
                source: 'external',
                provider: 'chromium-search'
            }]
        } catch { return [] }
    }).slice(0, 12)
    return { candidates }
})
