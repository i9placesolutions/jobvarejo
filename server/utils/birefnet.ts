import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
const execute = promisify(execFile)
let queue: Promise<unknown> = Promise.resolve()
export const removeBackgroundBiRefNet = (input: Buffer): Promise<Buffer> => {
    const task = queue.catch(() => {}).then(async () => {
        const directory = await mkdtemp(join(tmpdir(), 'birefnet-'))
        try {
            const source = join(directory, 'input.png')
            const target = join(directory, 'output.png')
            await writeFile(source, input)
            await execute(process.env.PRODUCT_IMAGE_PYTHON || 'python3',
                [resolve(process.cwd(), 'workers/remove_background.py'), source, target],
                { timeout: 180000, maxBuffer: 2 * 1024 * 1024 })
            return await readFile(target)
        } finally { await rm(directory, { recursive: true, force: true }) }
    })
    queue = task
    return task
}
