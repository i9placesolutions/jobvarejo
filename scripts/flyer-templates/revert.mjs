#!/usr/bin/env node
/**
 * Desfaz uma gravação de persist.mjs: aponta cada página de volta para o canvas e a miniatura
 * anteriores (registrados em <plano>/saved.json). Os arquivos anteriores nunca foram apagados.
 *
 *   node --env-file=.env scripts/flyer-templates/revert.mjs <plano> --confirm
 */
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
import pg from 'pg'

const [planDir] = process.argv.slice(2)
if (!planDir || !process.argv.includes('--confirm')) { console.error('Uso: revert.mjs <plano> --confirm'); process.exit(1) }
// Todos os registros de gravação do plano (saved.json, saved-<revisão>.json, recuperados), sem repetir modelo.
const records = (await fs.readdir(planDir)).filter(name => /^saved.*\.json$/.test(name))
const byProject = new Map()
for (const name of records) for (const entry of JSON.parse(await fs.readFile(`${planDir}/${name}`, 'utf8')).saved || []) if (!byProject.has(entry.projectId)) byProject.set(entry.projectId, entry)
const saved = [...byProject.values()]
const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL, connectionTimeoutMillis: 15000 })
await db.connect()
let reverted = 0
try {
  for (const entry of saved) {
    const row = (await db.query('select canvas_data, template_config from projects where id=$1 and is_template=true', [entry.projectId])).rows[0]
    if (!row) continue
    const canvasData = structuredClone(row.canvas_data), config = structuredClone(row.template_config)
    for (const prev of entry.previous) {
      const page = canvasData.find(p => p.id === prev.page)
      if (!page) continue
      if (!prev.canvasDataPath) continue
      // Miniatura anterior só quando registrada (registros recuperados do snapshot não têm).
      const restore = Object.fromEntries(Object.entries({ canvasDataPath: prev.canvasDataPath, thumbnailPath: prev.thumbnailPath, thumbnailUrl: prev.thumbnailUrl }).filter(([, v]) => v))
      Object.assign(page, restore, { canvasSavedAt: Date.now() })
      for (const blueprint of config?.pageBlueprints || []) if (blueprint.sourcePageId === page.id) Object.assign(blueprint, restore)
    }
    const preview = (canvasData.find(p => p.templateFormatId === 'feed') || canvasData[0])?.thumbnailUrl
    const r = await db.query('update projects set canvas_data=$1::jsonb, template_config=$2::jsonb, preview_url=$3, updated_at=now() where id=$4 and is_template=true',
      [JSON.stringify(canvasData), JSON.stringify(config), preview, entry.projectId])
    assert.equal(r.rowCount, 1)
    reverted++
  }
} finally { await db.end() }
console.log({ modelosRevertidos: reverted })
