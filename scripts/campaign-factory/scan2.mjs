// Busca genérica no acervo: node scan2.mjs <saida.json> <filtro content_type> termos...
import fs from 'node:fs/promises';
import { api } from './api.mjs';
const [out, type, ...terms] = process.argv.slice(2);
const all = [];
for (const term of terms) {
  const r = await api('/v1/resources', { term, limit: 40, [`filters[content_type][${type}]`]: 1 });
  for (const d of r.data) all.push({ term, id: d.id, title: d.title, formats: Object.keys(d.meta?.available_formats || {}), size: Object.values(d.meta?.available_formats || {}).flatMap(f => f.items).reduce((a, i) => Math.max(a, i.size), 0), thumb: d.image?.source?.url, orientation: d.image?.orientation, downloads: d.stats?.downloads ?? 0 });
}
const seen = new Set(); const u = all.filter(x => !seen.has(x.id) && seen.add(x.id));
await fs.writeFile(out, JSON.stringify(u, null, 1)); console.log(u.length);
