// Compara selos candidatos (PNG transparente) com os selos do sistema; gera folha candidato × 4 mais parecidos.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const N = 24;
const vec = async f => {
  const { data } = await sharp(f).trim({ threshold: 1 }).resize(N, N, { fit: 'fill' }).flatten({ background: '#808080' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const v = Float32Array.from(data), m = v.reduce((a, b) => a + b) / v.length; let n = 0;
  for (let i = 0; i < v.length; i++) { v[i] -= m; n += v[i] ** 2; } n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++) v[i] /= n; return v;
};
const existing = JSON.parse(await fs.readFile('existing.json', 'utf8'));
for (const e of existing) e.v = await vec(e.file).catch(() => null);
const S = 200, rows = [];
const report = [];
for (const f of process.argv.slice(2)) {
  const v = await vec(f);
  const top = existing.filter(e => e.v).map(e => ({ e, s: e.v.reduce((a, x, i) => a + x * v[i], 0) })).sort((a, b) => b.s - a.s).slice(0, 4);
  report.push({ file: f, best: top[0].s.toFixed(3), name: top[0].e.names[0] });
  console.log(f, top.map(t => `${t.s.toFixed(3)} ${t.e.names[0]}`).join(' | '));
  const tiles = [];
  for (const [i, file] of [f, ...top.map(t => t.e.file)].entries()) tiles.push({ input: await sharp(file).resize(S, S, { fit: 'contain', background: '#808080' }).flatten({ background: '#808080' }).png().toBuffer(), left: i * (S + 4) + (i ? 12 : 0), top: rows.length * (S + 4) });
  rows.push(tiles);
}
await sharp({ create: { width: 5 * (S + 4) + 12, height: rows.length * (S + 4), channels: 3, background: '#fff' } }).composite(rows.flat()).jpeg().toFile(process.env.OUT || 'similar.jpg');
