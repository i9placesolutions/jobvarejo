// Baixa fotos do acervo (fundos) para bg-raw/<id>.<ext>; zip é descompactado.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { api } from './api.mjs';
await fs.mkdir('bg-raw', { recursive: true });
for (const id of process.argv.slice(2)) {
  if ((await fs.readdir('bg-raw')).some(f => f.startsWith(id + '.'))) { console.log('já existe', id); continue; }
  const { data } = await api(`/v1/resources/${id}/download`);
  const ext = (data.filename.split('.').pop() || 'jpg').toLowerCase();
  const r = await fetch(data.url); if (!r.ok) throw Error(`HTTP ${r.status} ${id}`);
  const out = `bg-raw/${id}.${ext}`;
  await fs.writeFile(out, Buffer.from(await r.arrayBuffer()));
  if (ext === 'zip') { const dir = `bg-raw/${id}-zip`; execFileSync('unzip', ['-o', '-q', out, '-d', dir]); console.log('zip', id, execFileSync('ls', ['-R', dir]).toString().replace(/\n/g, ' ')); }
  else console.log('ok', out, Math.round((await fs.stat(out)).size / 1e5) / 10 + 'MB');
}
