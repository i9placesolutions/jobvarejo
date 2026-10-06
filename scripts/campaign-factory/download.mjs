// Baixa o PSD original do acervo Magnific (download de stock, sem IA) para raw/<id>.psd.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { api } from './api.mjs';
await fs.mkdir('raw', { recursive: true });
for (const id of process.argv.slice(2)) {
  const out = `raw/${id}.psd`;
  if (existsSync(out)) { console.log('já existe', out); continue; }
  const { data } = await api(`/v1/resources/${id}/download/psd`);
  const r = await fetch(data[0].url);
  if (!r.ok) throw Error(`HTTP ${r.status} ${id}`);
  await fs.writeFile(out, Buffer.from(await r.arrayBuffer()));
  console.log('ok', out, Math.round((await fs.stat(out)).size / 1e6) + 'MB');
}
