import { existsSync } from 'node:fs'
import { basename, resolve } from 'node:path'

/** Nuxt preview executa dentro de .output; os workers ficam na raiz do projeto. */
export const resolveImageWorkerPath = (filename: string, cwd = process.cwd()): string => {
    const direct = resolve(cwd, 'workers', filename)
    if (existsSync(direct)) return direct
    if (basename(cwd) === '.output') {
        const parent = resolve(cwd, '..', 'workers', filename)
        if (existsSync(parent)) return parent
    }
    throw new Error(`Worker de imagem indisponível: ${filename}`)
}
