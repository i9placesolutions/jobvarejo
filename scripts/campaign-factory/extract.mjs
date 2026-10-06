// Extrai o selo 3D (camada principal já renderizada pelo autor) como PNG transparente recortado rente.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { readPsd, initializeCanvas } from 'ag-psd';
import { createCanvas, createImageData } from 'canvas';
initializeCanvas(createCanvas, createImageData);
await fs.mkdir(process.env.DEST || 'seals', { recursive: true });
// Nome da camada do selo em cada PSD (grupos de fundo, texto e sombras ficam de fora).
const LAYER = { 58378153: 'gift', 16060974: '3D CUBE PERCENTAGE', 378782681: 'ICONS PERCENTAGE', 378782975: 'ICONS PERCENTAGE', 171916144: '3D LABEL', 223438820: '3D LABEL', 40855901: '3D LABEL', 427977200: '3D LOGO', 428026446: '3D STAMP', 428026441: '3D STAMP', 428026443: '3D STAMP', 409787719: 'SELO FIM DE SEMANA IMBATIVEL RENDER 3D', 422702019: 'Selo 3D Black Friday Antecipada PNG Transparente', 373928820: '3d-render', 49462352: '3d render', 47967040: '3d-render', 40056106: '3D LABEL' };
const all = (ls, name, out = []) => { for (const l of ls || []) { if (l.name === name && !l.children) out.push(l); all(l.children, name, out); } return out; };
// "Nome#n" pega a n-ésima camada com o mesmo nome (PSDs com vários elementos iguais).
const find = (ls, key) => { const [name, n = 1] = key.split('#'); return all(ls, name)[Number(n) - 1]; };
// Sem nome conhecido: maior camada renderizada fora dos grupos de fundo/texto, que não cubra o quadro inteiro.
const SKIP = /back|bg|fundo|shadow|sombra|textur|shape|box|alpha|color|cor|preench|info|text/i;
const pick = psd => { const out = []; const walk = (ls, skip) => { for (const l of ls || []) { const s = skip || SKIP.test(l.name); if (l.children) walk(l.children, s); else if (!s && !l.hidden && !l.text && l.imageData && !(l.left <= 0 && l.top <= 0 && l.right >= psd.width && l.bottom >= psd.height)) out.push(l); } }; walk(psd.children, false); return out.sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top))[0]; };
for (const arg of process.argv.slice(2)) {
  const [id, part] = arg.split(':');
  const psd = readPsd(await fs.readFile(`${process.env.SRC || 'raw'}/${id}.psd`), { useImageData: true, skipThumbnail: true, skipCompositeImageData: true });
  const key = part ? `${LAYER[id]}#${part}` : LAYER[id];
  const l = key ? find(psd.children, key) : pick(psd);
  if (!l?.imageData) throw Error(`sem camada ${LAYER[id]} em ${id}`);
  const im = l.imageData;
  const out = await sharp(Buffer.from(im.data.buffer, im.data.byteOffset, im.data.byteLength), { raw: { width: im.width, height: im.height, channels: 4 } })
    .trim({ threshold: 1 }).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  await fs.writeFile(`${process.env.DEST || 'seals'}/${id}${part ? '-' + part : ''}.png`, out.data);
  console.log(id, l.name, out.info.width, out.info.height, l.opacity ?? 1);
}
