// Lista a árvore de camadas do PSD e grava a imagem composta (como salva pelo autor).
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { readPsd, initializeCanvas } from 'ag-psd';
import { createCanvas, createImageData } from 'canvas';
initializeCanvas(createCanvas, createImageData);
const id = process.argv[2];
const psd = readPsd(await fs.readFile(`raw/${id}.psd`), { useImageData: true, skipThumbnail: true });
const walk = (ls, d = 0) => { for (const l of ls || []) { console.log(' '.repeat(d * 2) + `${l.hidden ? '(oculta) ' : ''}${l.name} [${l.left},${l.top},${l.right},${l.bottom}]${l.text ? ' TEXTO' : ''}${l.blendMode && l.blendMode !== 'normal' ? ' ' + l.blendMode : ''}${l.effects ? ' fx' : ''}${l.placedLayer ? ' smart' : ''}${l.adjustment ? ' ajuste' : ''}`); walk(l.children, d + 1); } };
console.log(psd.width, psd.height); walk(psd.children);
const im = psd.imageData;
if (im) await sharp(Buffer.from(im.data.buffer), { raw: { width: im.width, height: im.height, channels: 4 } }).resize(800).png().toFile(`raw/${id}-composite.png`);
