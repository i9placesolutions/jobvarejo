// Varre o acervo por selos 3D de varejo (PSD/PNG) e grava candidatos com formatos disponíveis.
import fs from 'node:fs/promises';
import { api } from './api.mjs';
const terms = process.argv.slice(2);
const out = [];
for (const term of terms) {
  for (const page of [1, 2]) {
    const r = await api('/v1/resources', { term, limit: 50, page, 'filters[content_type][psd]': 1 });
    for (const d of r.data) out.push({ term, id: d.id, title: d.title, formats: Object.keys(d.meta?.available_formats || {}), size: Object.values(d.meta?.available_formats || {}).flatMap(f => f.items).reduce((a, i) => Math.max(a, i.size), 0), thumb: d.image?.source?.url, premium: d.licenses?.[0]?.type, downloads: d.stats?.downloads, author: d.author?.name });
  }
}
const seen = new Set(), uniq = out.filter(x => !seen.has(x.id) && seen.add(x.id));
await fs.writeFile('scan.json', JSON.stringify(uniq, null, 1));
console.log(uniq.length, 'candidatos');
const fmt = {}; for (const x of uniq) fmt[x.formats.join('+')] = (fmt[x.formats.join('+')] || 0) + 1; console.log(fmt);
