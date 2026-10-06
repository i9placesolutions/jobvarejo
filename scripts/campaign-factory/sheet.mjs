// Folha de contato com miniaturas de pré-visualização (sem custo) para escolher os itens.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const [src, out, n = 48, filter = ''] = process.argv.slice(2);
let items = JSON.parse(await fs.readFile(src, 'utf8'));
if (filter) { const re = new RegExp(filter, 'i'); items = items.filter(x => !re.test(x.title)); }
items = items.sort((a, b) => b.downloads - a.downloads).slice(0, Number(n));
const S = 220, cols = 8, tiles = [];
await Promise.all(items.map(async (x, i) => {
  try {
    const buf = Buffer.from(await (await fetch(x.thumb)).arrayBuffer());
    const img = await sharp(buf).resize(S, S, { fit: 'contain', background: '#fff' }).toBuffer();
    const cap = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="20"><rect width="100%" height="100%" fill="#111"/><text x="3" y="14" font-family="Arial" font-size="12" fill="#ff0">${i} · ${x.id}</text></svg>`);
    tiles[i] = { input: await sharp({ create: { width: S, height: S + 20, channels: 3, background: '#111' } }).composite([{ input: img, top: 0, left: 0 }, { input: cap, top: S, left: 0 }]).png().toBuffer(), left: (i % cols) * (S + 4), top: Math.floor(i / cols) * (S + 24) };
  } catch {}
}));
const rows = Math.ceil(items.length / cols);
await sharp({ create: { width: cols * (S + 4), height: rows * (S + 24), channels: 3, background: '#444' } }).composite(tiles.filter(Boolean)).jpeg({ quality: 80 }).toFile(out);
await fs.writeFile(out.replace(/\.jpg$/, '.json'), JSON.stringify(items.map((x, i) => ({ i, id: x.id, title: x.title })), null, 1));
console.log('ok', items.length);
