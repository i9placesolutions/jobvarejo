#!/usr/bin/env node
/**
 * Inventário dos modelos baixados por snapshot.mjs: tipo de rodapé, campos dinâmicos presentes e
 * títulos ("Fale conosco", "Endereço", "Cartões aceitos") por página e formato.
 * Uso: node scripts/flyer-templates/inventory.mjs <pasta-do-snapshot>
 */
import fs from 'node:fs/promises'

const dir = process.argv[2]
const { projects } = JSON.parse(await fs.readFile(`${dir}/projects.json`, 'utf8'))
const walk = (objects, visit) => { for (const o of objects || []) { visit(o); if (Array.isArray(o.objects)) walk(o.objects, visit) } }
const TITLE_NAMES = ['footer-reference-whatsapp-label', 'footer-reference-address-label', 'footer-payment-label']

const rows = []
for (const project of projects) for (const page of project.pages) {
  const canvas = JSON.parse(await fs.readFile(`${dir}/pages/${page.file}.json`, 'utf8'))
  const fields = new Set(), names = new Set(), footerLayouts = new Set()
  walk(canvas.objects, o => {
    if (o.businessProfileField) fields.add(o.businessProfileField)
    if (o.quickDataField) fields.add(`data:${o.quickDataField}`)
    if (o.name) names.add(o.name)
    if (o.footerLayout) footerLayouts.add(`${o.name || o.type}:${o.footerLayout}`)
  })
  const footer = [...footerLayouts].find(l => l.startsWith('footer-')) || (names.has('footer-premium-background') ? 'footer-premium-background:(sem layout)' : '')
  rows.push({ project: project.id, model: project.name, page: page.id, format: page.format, footer: footer || '(sem rodapé reconhecido)',
    whatsapp: fields.has('whatsapp'), address: fields.has('address'), payment: fields.has('footerPaymentImages'), instagram: fields.has('instagram'),
    titles: TITLE_NAMES.filter(n => names.has(n)).length, objects: canvas.objects?.length || 0 })
}

const count = (key, filter = () => true) => Object.entries(rows.filter(filter).reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
console.log('modelos', projects.length, 'páginas', rows.length)
console.log('\npáginas por formato', count('format'))
console.log('\nrodapé (todas)', count('footer'))
console.log('\nrodapé fora da TV', count('footer', r => r.format !== 'tv'))
console.log('\ntítulos no rodapé (fora da TV)', count('titles', r => r.format !== 'tv'))
console.log('\nsem WhatsApp fora da TV', rows.filter(r => r.format !== 'tv' && !r.whatsapp).length,
  '| sem endereço', rows.filter(r => r.format !== 'tv' && !r.address).length,
  '| sem cartões', rows.filter(r => r.format !== 'tv' && !r.payment).length,
  '| sem Instagram', rows.filter(r => r.format !== 'tv' && !r.instagram).length)
await fs.writeFile(`${dir}/inventory.json`, JSON.stringify(rows, null, 2))
