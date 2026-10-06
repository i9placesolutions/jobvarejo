// Prévia rápida das 10 identidades (formato dado por F, padrão feed), com o selo por cima.
import sharp from 'sharp';
import { layoutFor } from '../compose.mjs';
import { designBackground } from '../design.mjs';
import { CAMPAIGNS, PALETTES, DECOR, LOOK } from '../campaigns.mjs';
const [f, W, H] = (process.env.F || 'feed,1080,1350').split(',').map((v, i) => i ? +v : v);
const tiles = [];
for (const c of CAMPAIGNS) {
  const { style, layout } = LOOK[c.slug], L = layoutFor(f, W, H, layout);
  const items = DECOR[c.slug].items.map(i => ({ file: `elements/${i.id}.png`, hue: i.hue || 0 }));
  const bg = await designBackground({ W, H, f, L, P: PALETTES[c.palette], star: { file: 'elements/19427445.png' }, items, seed: c.slug.length * 7919 + c.seal % 1000, style });
  const seal = await sharp(`work/${c.slug}/seal.png`).resize({ width: Math.round(L.seal.w), height: Math.round(L.seal.h), fit: 'inside' }).png().toBuffer();
  const m = await sharp(seal).metadata();
  const img = await sharp(bg).composite([{ input: seal, left: Math.round(L.seal.x + (L.seal.w - m.width) / 2), top: Math.round(L.seal.y + (L.seal.h - m.height) / 2) }]).jpeg().toBuffer();
  tiles.push(await sharp(img).resize({ height: 520 }).toBuffer());
}
const ms = await Promise.all(tiles.map(t => sharp(t).metadata())), tw = ms[0].width;
await sharp({ create: { width: 5 * (tw + 8), height: 2 * 528, channels: 3, background: '#fff' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % 5) * (tw + 8), top: Math.floor(i / 5) * 528 }))).jpeg({ quality: 85 }).toFile(process.env.OUT || 'test/looks.jpg');
console.log('ok');
