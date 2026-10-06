// Busca fundos em vídeo (loops) no acervo; node scan-video.mjs <saida> <aspect 9:16|16:9> termos...
import fs from 'node:fs/promises';
import { api } from './api.mjs';
const [out, aspect, ...terms] = process.argv.slice(2);
const all = [];
for (const term of terms) {
  const r = await api('/v1/videos', { term, limit: 24, [`filters[aspect-ratio][${aspect}]`]: 1 });
  for (const d of r.data) all.push({ term, id: d.id, title: d.name, aspect: d.aspect_ratio, duration: d.duration, quality: d.quality, thumb: (d.thumbnails?.[1] || d.thumbnails?.[0])?.url, downloads: 0 });
}
const seen = new Set(); const u = all.filter(x => !seen.has(x.id) && seen.add(x.id));
await fs.writeFile(out, JSON.stringify(u, null, 1)); console.log(u.length, [...new Set(u.map(x => x.aspect))]);
