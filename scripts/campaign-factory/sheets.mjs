// Folha de conferência: uma linha por campanha com os 5 formatos.
import sharp from 'sharp';
import { existsSync } from 'node:fs';
const slugs = process.argv.slice(2), H = 420, out = process.env.OUT || 'sheet-campaigns.jpg';
const rows = [];
for (const s of slugs) {
  const tiles = []; let x = 0;
  for (const f of ['stories', 'feed', 'square', 'print', 'tv']) {
    const file = `out/${s}/${process.env.PREFIX || ''}${f}.png`; if (!existsSync(file)) continue;
    const b = await sharp(file).resize({ height: H }).png().toBuffer(); const w = (await sharp(b).metadata()).width;
    tiles.push({ input: b, left: x, top: 0 }); x += w + 8;
  }
  rows.push({ input: await sharp({ create: { width: x, height: H, channels: 3, background: '#fff' } }).composite(tiles).png().toBuffer(), w: x });
}
const W = Math.max(...rows.map(r => r.w));
await sharp({ create: { width: W, height: rows.length * (H + 8), channels: 3, background: '#fff' } }).composite(rows.map((r, i) => ({ input: r.input, left: 0, top: i * (H + 8) }))).jpeg({ quality: 82 }).toFile(out);
console.log(out);
