// Integra as campanhas ao catálogo reutilizável: fundo animado do vídeo (vertical e horizontal), selo, fundos
// ricos, cabeçalho do cartaz, elementos 3D, receitas de vídeo e procedência. Rodar na raiz; depois publicar com
// node --env-file=.env scripts/video-studio/migrate-catalog-to-wasabi.mjs --upload --archive
// Uso: node output/campanhas-magnific-2026-10-06/integrate.mjs [slug...]
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CAMPAIGNS, PALETTES, DECOR, LOOK, VIDEO_FX, videoLayout } from './campaigns.mjs';
const exec = promisify(execFile);

const root = 'output/campanhas-magnific-2026-10-06';
const T = 'public/video-studio/templates';
const only = process.argv.slice(2);
const selected = CAMPAIGNS.filter(c => !only.length || only.includes(c.slug));
await fs.mkdir(`${T}/backgrounds-video`, { recursive: true });
await fs.mkdir(`${T}/catalog`, { recursive: true });
const ids = JSON.parse(await fs.readFile(`${root}/ids.json`, 'utf8'));
const videoMeta = JSON.parse(await fs.readFile(`${root}/video-raw/meta.json`, 'utf8'));
const music = JSON.parse(await fs.readFile('shared/video-studio/music-library.json', 'utf8'));
const probe = async f => Number((await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f])).stdout.trim());

// 1) Arquivos do catálogo por campanha.
const files = c => ({
  seal: `catalog/magnific-${c.slug}-seal.png`, background: `catalog/magnific-${c.slug}-background.jpg`, backgroundWide: `catalog/magnific-${c.slug}-background-wide.jpg`,
  cartazHeader: `catalog/magnific-${c.slug}-cartaz-header.jpg`, videoVertical: `backgrounds-video/magnific-${c.slug}-vertical.mp4`, videoWide: `backgrounds-video/magnific-${c.slug}-wide.mp4`
});
const seconds = {};
for (const c of selected) {
  const w = `${root}/work/${c.slug}`, f = files(c);
  await fs.copyFile(`${w}/seal.png`, `${T}/${f.seal}`);
  await fs.copyFile(`${w}/bg-stories.jpg`, `${T}/${f.background}`);
  await fs.copyFile(`${w}/bg-tv.jpg`, `${T}/${f.backgroundWide}`);
  await fs.copyFile(`${w}/cartaz-header.jpg`, `${T}/${f.cartazHeader}`);
  await fs.copyFile(`${w}/video-bg-vertical.mp4`, `${T}/${f.videoVertical}`);
  await fs.copyFile(`${w}/video-bg-horizontal.mp4`, `${T}/${f.videoWide}`);
  seconds[c.slug] = { v: await probe(`${T}/${f.videoVertical}`), w: await probe(`${T}/${f.videoWide}`) };
}
const elementIds = [...new Set(selected.flatMap(c => DECOR[c.slug].items.map(i => i.id)))];
for (const el of elementIds) await fs.copyFile(`${root}/elements/${el}.png`, `${T}/catalog/magnific-element-${el}.png`);

// 2) Receitas de vídeo: hierarquia do Sextou e efeitos fortes de varejo (impacto, explosões, brilho no preço).
const MOTION = {
  impact: { speed: 'fast', finish: 'shine', product: 'slam', text: 'stomp', price: 'elastic', camera: 'impact', atmosphere: ['shockwave', 'speed-lines'], transitionSound: 'whip', accentSound: 'boom' },
  bounce: { speed: 'fast', finish: 'shine', product: 'elastic', text: 'word-pop', price: 'slam', camera: 'zoom-pulse', atmosphere: ['spark-burst', 'shockwave'], transitionSound: 'air-swipe', accentSound: 'coin' },
  camera: { speed: 'fast', finish: 'glow', product: 'zoom-out', text: 'stretch', price: 'drop', camera: 'impact', atmosphere: ['energy-starburst', 'speed-lines'], transitionSound: 'riser', accentSound: 'bass-hit' },
  embers: { speed: 'fast', finish: 'shine', product: 'slam', text: 'stomp', price: 'elastic', camera: 'earthquake', atmosphere: ['fire-jets', 'embers'], transitionSound: 'whip', accentSound: 'boom' }
};
const sextou = JSON.parse(await fs.readFile('shared/video-studio/custom-flyer-recipes.json', 'utf8')).find(r => r.sourceProject === '27afa93d-135e-4c41-8565-7f53188ce212');
const recipes = selected.map(c => {
  const p = PALETTES[c.palette], sourceProject = ids[c.slug].projectId, f = files(c), track = music.find(m => m.id === c.music);
  return {
    id: `flyer-${sourceProject}`, sourceProject, name: c.name, campaign: c.name.toUpperCase(),
    accent: p.accent, base: p.card[2], ink: '#ffffff', label: 'banner',
    labelNames: c.palette === 'red' || c.palette === 'yellowRed' ? sextou.labelNames : ['Padrão'],
    background: f.background, backgroundHorizontal: f.backgroundWide, seal: f.seal, posterLayout: 'thematic-seal',
    music: c.music, musicStyle: track?.category || 'retail', bpm: track?.bpm || 120,
    seed: parseInt(sourceProject.slice(0, 8), 16), transition: VIDEO_FX[c.slug].transition, motion: MOTION[VIDEO_FX[c.slug].motion],
    semanticMotifs: false, backgroundKind: VIDEO_FX[c.slug].motion === 'embers' ? 'embers' : 'impact', revision: 3, layoutName: c.name,
    ...videoLayout(LOOK[c.slug].layout),
    backgroundVideo: f.videoVertical, backgroundVideoDuration: Math.floor(seconds[c.slug].v * 100) / 100,
    backgroundVideoHorizontal: f.videoWide, backgroundVideoHorizontalDuration: Math.floor(seconds[c.slug].w * 100) / 100,
    validityStyle: 'ribbon', ribbonColors: { ribbon: [p.card[1], p.card[2], p.card[3]], edge: p.card[0], pill: p.pill, stockInk: p.stockInk }, preserveVerticalLayout: true, preferSingleProduct: true,
    posterPriceCornerRadius: 0.01, posterRetailFinish: { labelFill: p.card[2], labelInk: '#ffffff', labelEdge: p.accent }, preserveBrandLayout: true
  };
});
for (const [file, pretty] of [['shared/video-studio/custom-flyer-recipes.json', true], ['shared/video-studio/generated-flyer-recipes.json', false]]) {
  const list = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const r of recipes) { const i = list.findIndex(x => x.sourceProject === r.sourceProject); if (i >= 0) list[i] = r; else list.push(r); }
  await fs.writeFile(file, pretty ? JSON.stringify(list, null, 2) + '\n' : JSON.stringify(list));
  console.log('receitas', file, list.length);
}

// 3) Cabeçalho do cartaz (layout thematic-seal do Cartazista): faixa própria com luz e elementos, selo e logo.
const headerFile = 'shared/cartazista/header-assets.json';
const headers = JSON.parse(await fs.readFile(headerFile, 'utf8'));
for (const c of selected) headers[ids[c.slug].projectId] = { background: `/video-studio/templates/${files(c).cartazHeader}`, seal: `/video-studio/templates/${files(c).seal}`, backgroundCropY: 0.5 };
await fs.writeFile(headerFile, JSON.stringify(headers, null, 2) + '\n');

// 4) Procedência (licença e origem de cada item baixado), sempre com as 10 campanhas.
const scan = ['scan.json', 'scan-elements.json', 'scan-el2.json', 'scan-bgp.json'].flatMap(f => JSON.parse(readFileSync(`${root}/${f}`, 'utf8')));
const info = id => { const s = scan.find(x => String(x.id) === String(id).split('-')[0]); return { magnificId: Number(String(id).split('-')[0]), titulo: s?.title }; };
await fs.writeFile('docs/video-studio/magnific-campanhas-provenance.json', JSON.stringify({
  fonte: 'Magnific (antigo Freepik) — download do acervo de stock via API, plano Premium, uso interno para clientes (sem geração por IA)',
  licenca: 'https://www.magnific.com/legal/terms-of-use', atualizadoEm: new Date().toISOString(),
  campanhas: CAMPAIGNS.map(c => ({ slug: c.slug, nome: c.name, projeto: ids[c.slug].projectId, selo: info(c.seal), fotoFundo: info(c.bg), elementos: DECOR[c.slug].items.map(i => info(i.id)),
    videoRaios: videoMeta[c.video], overlays: [videoMeta[9031541], videoMeta[3964557]], musica: c.music, arquivos: files(c) })),
  elementos: [...new Set(CAMPAIGNS.flatMap(c => DECOR[c.slug].items.map(i => i.id)))].map(id => ({ ...info(id), arquivo: `templates/catalog/magnific-element-${id}.png` }))
}, null, 1) + '\n');
console.log('ok', selected.map(c => c.slug).join(', '));
