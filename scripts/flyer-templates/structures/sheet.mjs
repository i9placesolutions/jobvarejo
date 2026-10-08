#!/usr/bin/env node
// Prancha das variações de um tema: linhas = estruturas, colunas = formatos (prévias com produtos).
// Uso: node scripts/flyer-templates/structures/sheet.mjs <saída-do-build>/<tema> <arquivo.jpg>
import fs from 'node:fs/promises'
import sharp from 'sharp'
const [dir, outFile] = process.argv.slice(2)
const manifest = JSON.parse(await fs.readFile(`${dir}/manifest.json`, 'utf8'))
const H = 520, gap = 20, label = 44
const structures = [...new Set(manifest.blueprints.map(b => b.structureId))], formats = ['feed', 'square', 'stories', 'print', 'tv']
const widthOf = f => { const b = manifest.blueprints.find(x => x.formatId === f); return Math.round(H * b.width / b.height) }
const totalW = gap + formats.reduce((s, f) => s + widthOf(f) + gap, 0)
const comps = []
let y = gap
for (const s of structures) {
  const name = manifest.blueprints.find(b => b.structureId === s).structureName
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${label}"><text x="${gap}" y="32" font-family="Helvetica" font-weight="700" font-size="28" fill="#111">${name}</text></svg>`), left: 0, top: y })
  y += label
  let x = gap
  for (const f of formats) {
    const b = manifest.blueprints.find(v => v.structureId === s && v.formatId === f)
    comps.push({ input: await sharp(b.preview).resize(widthOf(f), H).png().toBuffer(), left: x, top: y })
    x += widthOf(f) + gap
  }
  y += H + gap
}
await sharp({ create: { width: totalW, height: y, channels: 3, background: '#eceef2' } }).composite(comps).jpeg({ quality: 85 }).toFile(outFile)
console.log(outFile)
