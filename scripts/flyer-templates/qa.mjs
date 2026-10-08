#!/usr/bin/env node
/**
 * Controle de qualidade do plano: em cada página ajustada, WhatsApp, endereço e cartões precisam
 * estar dentro da faixa do rodapé e sem sobreposição entre si (caixas medidas no render).
 * Uso: node scripts/flyer-templates/qa.mjs <plano>
 */
import fs from 'node:fs/promises'
const dir = process.argv[2]
const report = JSON.parse(await fs.readFile(`${dir}/report.json`, 'utf8'))
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
const bounds = o => { const w = num(o.width) * Math.abs(num(o.scaleX, 1)), h = num(o.height) * Math.abs(num(o.scaleY, 1)); return { left: num(o.left) - (o.originX === 'center' ? w / 2 : 0), top: num(o.top) - (o.originY === 'center' ? h / 2 : 0), width: w, height: h } }
const inside = (a, b, tol = 3) => a.left >= b.left - tol && a.top >= b.top - tol && a.left + a.width <= b.left + b.width + tol && a.top + a.height <= b.top + b.height + tol
const overlap = (a, b, tol = 2) => a.left + tol < b.left + b.width && b.left + tol < a.left + a.width && a.top + tol < b.top + b.height && b.top + tol < a.top + a.height
const issues = []
for (const r of report.filter(r => r.changes.length && !r.error)) {
  const canvas = JSON.parse(await fs.readFile(`${dir}/after/${r.file}.json`, 'utf8'))
  const bg = canvas.objects.find(o => o.name === 'footer-premium-background')
  const area = bounds(bg)
  const boxes = Object.fromEntries(['footer-dynamic-whatsapp', 'footer-dynamic-address', 'footer-payment-images'].map(n => [n, r.checks?.[n]]).filter(([, b]) => b))
  const problems = []
  for (const [name, box] of Object.entries(boxes)) if (!inside(box, area)) problems.push(`${name} fora da faixa`)
  const names = Object.keys(boxes)
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (overlap(boxes[names[i]], boxes[names[j]])) problems.push(`${names[i]} × ${names[j]}`)
  const titles = canvas.objects.filter(o => ['footer-reference-whatsapp-label', 'footer-reference-address-label', 'footer-payment-label'].includes(o.name) && o.visible !== false)
  for (const t of titles) if (!inside(bounds(t), area, 6)) problems.push(`${t.name} fora da faixa`)
  // Ícones não podem invadir o texto do bloco vizinho (ex.: número do WhatsApp sobre o ícone do endereço).
  const iconOf = name => { const o = canvas.objects.find(x => x.name === name && x.visible !== false); return o ? bounds(o) : null }
  const addressIcon = iconOf('icon-address')
  if (addressIcon && boxes['footer-dynamic-whatsapp'] && overlap(addressIcon, boxes['footer-dynamic-whatsapp'])) problems.push('WhatsApp sobre o ícone do endereço')
  // Texto do rodapé com espaçamento entre letras e reduzido pelo encaixe: no Fabric 7 vira letras espalhadas.
  for (const o of canvas.objects.filter(x => /^footer-/.test(x.name || '') && ['textbox', 'text', 'i-text'].includes(String(x.type).toLowerCase()) && x.visible !== false))
    if (Number(o.charSpacing) > 0 && Number(o.scaleX || 1) < .95) problems.push(`espaçamento de letras em ${o.name}`)
  if (problems.length) issues.push({ model: r.model, format: r.format, file: r.file, problems })
}
await fs.writeFile(`${dir}/qa.json`, JSON.stringify(issues, null, 2))
const byProblem = {}
for (const i of issues) for (const p of i.problems) byProblem[p] = (byProblem[p] || 0) + 1
console.log({ paginasVerificadas: report.filter(r => r.changes.length && !r.error).length, comProblema: issues.length }, byProblem)
