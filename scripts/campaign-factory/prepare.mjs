// Prepara os arquivos de cada campanha em work/<slug>/: selo, fundos desenhados por formato (design.mjs),
// cabeçalho do cartaz e bases do vídeo (fundo desenhado + raios para girar).
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { CAMPAIGNS, PALETTES, DECOR, LOOK, videoLayout } from './campaigns.mjs';
import { layoutFor } from './compose.mjs';
import { designBackground, raysPng } from './design.mjs';

const SIZES = [['stories', 1080, 1920], ['feed', 1080, 1350], ['square', 1080, 1080], ['print', 794, 1123], ['tv', 1920, 1080]];
const only = process.argv.slice(2);
const STAR = { file: 'elements/19427445.png' };
// Layout "sem painel" para cartaz e vídeo: só a área do selo importa.
const bare = (seal, W, H) => ({ seal, panel: { x: 0, y: H + 200, w: W, h: 10 }, card: { x: 0, y: 0, w: W, h: H } });

for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
  const dir = `work/${c.slug}`, d = DECOR[c.slug], P = PALETTES[c.palette], { style, layout } = LOOK[c.slug];
  await fs.mkdir(dir, { recursive: true });
  await sharp(`seals/${c.seal}.png`).trim({ threshold: 1 }).resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).png().toFile(`${dir}/seal.png`);
  const items = d.items.map(i => ({ file: `elements/${i.id}.png`, hue: i.hue || 0 }));
  const seed = c.slug.length * 7919 + c.seal % 1000;
  for (const [f, W, H] of SIZES) {
    await fs.writeFile(`${dir}/bg-${f}.jpg`, await designBackground({ W, H, f, L: layoutFor(f, W, H, layout), P, star: STAR, items, seed, style }));
  }
  // Cabeçalho do cartaz (faixa 2480×760): selo em 2–61% da largura, como applyCartazistaHeader.
  {
    const W = 2480, H = 760;
    await fs.writeFile(`${dir}/cartaz-header.jpg`, await designBackground({ W, H, f: 'band', L: bare({ x: W * .02, y: H * .03, w: W * .59, h: H * .94 }, W, H), P, star: STAR, items, seed, header: { x: 0, y: H * .05, w: W, h: H * .9 }, noPanel: true, style }));
  }
  // Bases do vídeo: mesmas caixas de selo das receitas (vertical [24,56,520,560], horizontal [60,24,560,560]).
  const vl = videoLayout(layout), box = ([x, y, w, h]) => ({ x, y, w, h });
  for (const [id, W, H, seal, header] of [
    ['vertical', 1080, 1920, box(vl.vertical.seal), { x: 0, y: 120, w: 1080, h: 640 }],
    ['horizontal', 1920, 1080, box(vl.horizontal.seal), { x: 0, y: 220, w: 1920, h: 640 }]
  ]) {
    await fs.writeFile(`${dir}/video-design-${id}.png`, await designBackground({ W, H, f: id === 'horizontal' ? 'tv' : 'video', L: bare(seal, W, H), P, star: null, items, seed, header, noPanel: true, style, format: 'png' }));
  }
  console.log('preparado', c.slug);
}
await fs.mkdir('work/overlays', { recursive: true });
await fs.writeFile('work/overlays/rays.png', await raysPng(2400));
