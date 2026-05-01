/**
 * Helpers puros para parsing de URLs de storage (Wasabi, Contabo).
 *
 * Sem dependencia de useRuntimeConfig (Nuxt) ou refs reativos —
 * configuredBucket vem como parametro injetado pelo caller.
 *
 * Cobertura: tests/utils/storageUrlHelpers.test.ts
 */

/**
 * Extrai bucket e key de uma URL no formato Wasabi path-style:
 *   https://s3.wasabisys.com/bucket/key/path...
 *
 * O bucket e' a primeira parte do path; key e' o resto. Quando key
 * fica vazio (URL apenas com bucket), retorna { bucket: null, key: null }.
 *
 * Erros de parse (URL invalida) retornam { bucket: null, key: null }.
 */
/**
 * Extrai a "key" (path do objeto no bucket) de uma URL Wasabi.
 *
 * Suporta dois formatos:
 *  - Path-style: https://s3.wasabisys.com/bucket/key/path...
 *    → key = "key/path..." (remove o bucket do inicio)
 *  - Virtual-host: https://bucket.s3.wasabisys.com/key/path...
 *    → key = "key/path..." (path inteiro, hostname tem o bucket)
 *
 * Heuristica do bucket: comparado com `configuredBucket` ou contendo ':'
 * (formato "tenant:bucket"). Quando o hostname contem o bucket configurado,
 * assume virtual-host e nao remove a primeira parte.
 *
 * Recebe `configuredBucket` como parametro injetado.
 */
export const extractWasabiKey = (url: string, configuredBucket: string): string | null => {
    try {
        const decodedUrl = decodeURIComponent(url)
        const urlObj = new URL(decodedUrl)
        const decodedPathname = decodeURIComponent(urlObj.pathname)
        const pathParts = decodedPathname.split('/').filter(p => p)

        if (pathParts.length === 0) return null

        const bucket = String(configuredBucket || 'jobvarejo')
        const hostname = (urlObj.hostname || '').toLowerCase()
        const first = pathParts[0] ?? ''
        const firstLooksLikeBucket = first === bucket || first.includes(':')
        const hostLooksLikeVirtualHost = hostname.includes(`${bucket.toLowerCase()}.`)

        const keyParts = (firstLooksLikeBucket && !hostLooksLikeVirtualHost)
            ? pathParts.slice(1)
            : pathParts
        const key = keyParts.join('/')

        if (!key || key.length === 0) return null
        return key
    } catch {
        return null
    }
}

/**
 * Converte uma URL presignada do Wasabi para a forma permanente
 * (sem query string). Pure: recebe `endpoint` e `configuredBucket`
 * injetados pelo caller — nao acessa useRuntimeConfig.
 *
 * Comportamento:
 *  - URL nao-Wasabi (sem 'wasabisys.com'): retorna como esta
 *  - URL sem querystring (ja permanente): retorna como esta
 *  - URL invalida ou sem key extraivel: retorna original
 *  - Caso contrario: `https://${endpoint}/${bucket}/${key}`
 */
export const convertPresignedToPermanentUrl = (
    url: string,
    endpoint: string,
    configuredBucket: string
): string => {
    if (!url.includes('wasabisys.com')) return url
    try {
        const urlObj = new URL(url)
        if (!urlObj.search) return url

        const key = extractWasabiKey(url, configuredBucket)
        if (!key) return url

        const ep = String(endpoint || 's3.wasabisys.com')
        const bucket = String(configuredBucket || 'jobvarejo')
        return `https://${ep}/${bucket}/${key}`
    } catch {
        return url
    }
}

/**
 * Extrai bucket e key de URL Contabo. Logica similar ao extractWasabiKey
 * mas detecta path-style com formato `tenant:bucket` (bucket Contabo
 * usa ':' no nome).
 *
 *  - Path-style "tenant:bucket/key/path": retorna { bucket: "tenant:bucket", key: "key/path" }
 *  - Virtual-host "bucket.s3.contabo.com/key": retorna { bucket: "bucket", key: "key" }
 *  - URL fora do bucket configurado: { bucket: null, key: pathInteiro } — proxy decide default
 *
 * Recebe `configuredBucket` injetado.
 */
export const extractContaboBucketAndKey = (
    url: string,
    configuredBucket: string
): { bucket: string | null; key: string | null } => {
    try {
        const decodedUrl = decodeURIComponent(url)
        const urlObj = new URL(decodedUrl)
        const decodedPathname = decodeURIComponent(urlObj.pathname)
        const pathParts = decodedPathname.split('/').filter(p => p)

        if (pathParts.length === 0) {
            return { bucket: null, key: null }
        }

        const candidates = new Set<string>()
        if (configuredBucket) candidates.add(configuredBucket)

        const first = pathParts[0] ?? ''
        const firstLooksLikeBucket = first.includes(':') || candidates.has(first)
        const hostLooksLikeVirtualHost = [...candidates].some(b =>
            b && urlObj.hostname.startsWith(`${b.toLowerCase()}.`)
        )

        let bucket: string | null = null
        let keyParts: string[]

        if (firstLooksLikeBucket && !hostLooksLikeVirtualHost) {
            bucket = first
            keyParts = pathParts.slice(1)
        } else if (hostLooksLikeVirtualHost) {
            const hostParts = urlObj.hostname.split('.')
            bucket = hostParts[0] || null
            keyParts = pathParts
        } else {
            bucket = null
            keyParts = pathParts
        }

        const key = keyParts.join('/')
        if (!key || key.length === 0) {
            return { bucket: null, key: null }
        }
        return { bucket, key }
    } catch {
        return { bucket: null, key: null }
    }
}

/**
 * Normaliza uma URL de imagem de recovery para uma URL acessivel
 * pelo proxy local. Aplica em ordem:
 *
 *  1. trim e early return em vazio
 *  2. toWasabiProxyUrl (callback injetado): se converteu, retorna
 *  3. URL Contabo: extrai bucket+key e mapeia para /api/storage/p
 *  4. fallback: retorna URL original
 *
 * Pure: nao acessa runtime config — caller injeta os 2 helpers.
 */
export const normalizeRecoveryImageUrl = (
    src: string,
    toWasabiProxyUrl: (s: string) => string | null,
    extractContabo: (s: string) => { bucket: string | null; key: string | null }
): string => {
    const value = String(src || '').trim()
    if (!value) return ''
    const proxied = toWasabiProxyUrl(value)
    if (proxied && proxied !== value) return proxied
    if (value.includes('contabostorage.com')) {
        const { bucket, key } = extractContabo(value)
        if (key) {
            if (bucket) {
                return `/api/storage/p?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
            }
            return `/api/storage/p?key=${encodeURIComponent(key)}`
        }
    }
    return value
}

export const extractWasabiBucketAndKey = (url: string): { bucket: string | null; key: string | null } => {
    try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(p => p)

        if (pathParts.length === 0) {
            return { bucket: null, key: null }
        }

        const bucket = pathParts[0] || null
        const key = pathParts.slice(1).join('/')

        if (!key || key.length === 0) {
            return { bucket: null, key: null }
        }

        return { bucket, key }
    } catch {
        return { bucket: null, key: null }
    }
}
