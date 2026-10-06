// Baixa vídeos de fundo do acervo na opção MP4 H.264 de maior resolução (4K quando houver) para video-raw/<id>.mp4.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { api } from './api.mjs';
await fs.mkdir('video-raw', { recursive: true });
const meta = existsSync('video-raw/meta.json') ? JSON.parse(await fs.readFile('video-raw/meta.json', 'utf8')) : {};
for (const id of process.argv.slice(2)) {
  const out = `video-raw/${id}.mp4`;
  if (existsSync(out)) { console.log('já existe', out); continue; }
  const { data } = await api(`/v1/videos/${id}`);
  const opt = data.options.filter(o => o.active && o.container === 'mp4').sort((a, b) => b.width - a.width)[0];
  const dl = await api(`/v1/videos/${id}/options/${opt.id}/download`);
  const r = await fetch(dl.data.url); if (!r.ok) throw Error(`HTTP ${r.status} ${id}`);
  await fs.writeFile(out, Buffer.from(await r.arrayBuffer()));
  meta[id] = { magnificId: id, titulo: data.name, pagina: data.url, autor: data.author?.name, duracao: data.duration, resolucao: `${opt.width}x${opt.height}`, baixadoEm: new Date().toISOString() };
  await fs.writeFile('video-raw/meta.json', JSON.stringify(meta, null, 1));
  console.log('ok', out, opt.width + 'x' + opt.height, Math.round((await fs.stat(out)).size / 1e6) + 'MB');
}
