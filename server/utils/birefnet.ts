import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolveImageWorkerPath } from './image-worker-path'
const execute = promisify(execFile)
let queue: Promise<unknown> = Promise.resolve()
export const removeBackgroundBiRefNet = (
    input: Buffer,
    model: 'birefnet-general-lite' | 'birefnet-general' = (process.env.BIREFNET_MODEL as any) || 'birefnet-general-lite'
): Promise<Buffer> => {
    if (model === 'birefnet-general') {
        const modelHome = process.env.U2NET_HOME || join(homedir(), '.u2net')
        if (!existsSync(join(modelHome, 'birefnet-general.onnx'))) {
            throw new Error('BiRefNet General não está pré-carregado; o recorte da embalagem foi cancelado com segurança')
        }
    }
    const task = queue.catch(() => {}).then(async () => {
        const directory = await mkdtemp(join(tmpdir(), 'birefnet-'))
        try {
            const source = join(directory, 'input.png')
            const target = join(directory, 'output.png')
            await writeFile(source, input)
            await execute(process.env.PRODUCT_IMAGE_PYTHON || 'python3',
                [resolveImageWorkerPath('remove_background.py'), source, target],
                { timeout: 180000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, BIREFNET_MODEL: model } })
            return await readFile(target)
        } finally { await rm(directory, { recursive: true, force: true }) }
    })
    queue = task
    return task
}
