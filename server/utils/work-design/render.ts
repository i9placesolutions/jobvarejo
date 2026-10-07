import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createError } from 'h3'
const execute = promisify(execFile)
let active = false

/** Consumidor próprio; reutiliza o worker nativo sem acionar jobs/envios do WhatsApp. */
export async function renderWorkCanvas(canvas: any, products: any[], formatId: string) {
  if (active) throw createError({ statusCode: 503, statusMessage: 'Render experimental ocupado.' })
  active = true
  let dir: string | undefined
  try {
    dir = await mkdtemp(join(tmpdir(), 'work-design-'))
    const input = join(dir, 'input.json')
    await writeFile(input, JSON.stringify({ canvas, products, formatId, division: 'single' }), { mode: 0o600 })
    const result = await execute(process.env.WORK_DESIGN_PYTHON || process.env.WHATSAPP_CREATION_PYTHON || 'python3',
      [resolve(process.cwd(), 'workers/whatsapp-creation/render.py'), '--input', input, '--output-dir', dir],
      { timeout: 100_000, maxBuffer: 2_000_000 })
    const manifest = JSON.parse(result.stdout)
    if (manifest.pages?.length !== 1 || manifest.pages[0].name !== 'page-1.png' || manifest.pages[0].canvas !== 'page-1.json')
      throw createError({ statusCode: 422, statusMessage: 'O motor retornou páginas inesperadas.' })
    return { canvas: JSON.parse(await readFile(join(dir, 'page-1.json'), 'utf8')), png: await readFile(join(dir, 'page-1.png')) }
  } finally { active = false; if (dir) await rm(dir, { recursive: true, force: true }) }
}
