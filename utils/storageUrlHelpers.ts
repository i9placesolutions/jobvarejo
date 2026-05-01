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
