import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { resolveImageWorkerPath } from './image-worker-path'
const execute = promisify(execFile)
let running = 0
export const runArtPython = async (
  payload: unknown
): Promise<{
  compositions?: unknown[]
  files?: Array<{ name: string; buffer: Buffer }>
}> => {
  if (running >= 2)
    throw createError({
      statusCode: 503,
      statusMessage:
        'O estúdio está montando outras artes. Tente novamente em alguns segundos.'
    })
  running++
  let directory: string | undefined
  try {
    directory = await mkdtemp(join(tmpdir(), 'art-studio-'))
    const worker = resolveImageWorkerPath('art_studio.py'),
      root = dirname(dirname(worker))
    const fontDir = [
      resolve(root, 'public/art-studio/fonts'),
      resolve(root, '.output/public/art-studio/fonts')
    ].find((p) => existsSync(join(p, 'Barlow-Regular.ttf')))
    const input = join(directory, 'input.json')
    await writeFile(input, JSON.stringify(payload), { mode: 0o600 })
    const result = await execute(
      process.env.ART_STUDIO_PYTHON ||
        process.env.PRODUCT_IMAGE_PYTHON ||
        'python3',
      [worker, '--input', input, '--output-dir', directory],
      {
        timeout: 90_000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          LANG: 'en_US.UTF-8',
          ART_STUDIO_FONT_DIR: fontDir,
          PYTHONIOENCODING: 'utf-8'
        }
      }
    )
    const data = JSON.parse(result.stdout)
    if (Array.isArray(data.files))
      return {
        files: await Promise.all(
          data.files.map(async (name: string) => {
            if (!/^arte-\d+-\d+x\d+\.png$/.test(name))
              throw new Error('Invalid worker filename')
            return { name, buffer: await readFile(join(directory!, name)) }
          })
        )
      }
    return data
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.code === 'ENOENT')
      throw createError({
        statusCode: 503,
        statusMessage:
          'Python do Estúdio de Artes não está disponível neste servidor.'
      })
    console.error(
      '[art-studio:python]',
      String(error?.stderr || error?.message || 'Worker failed').slice(0, 500)
    )
    throw createError({
      statusCode: error?.killed ? 504 : 422,
      statusMessage: error?.killed
        ? 'A montagem excedeu o tempo limite. Reduza a quantidade de formatos.'
        : 'Não foi possível montar a arte. Verifique se os textos cabem nas caixas e se Python/Pillow estão instalados.'
    })
  } finally {
    running--
    if (directory) await rm(directory, { recursive: true, force: true })
  }
}
