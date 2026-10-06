// Demonstração local do vídeo de uma campanha Magnific (SLUG=...) com dados reais da conta (somente leitura no banco).
// Uso (na raiz): SLUG=<campanha> node --env-file=.env <lote>/render-video.mjs [--stills] [--mp4] [--doc]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { register } from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs';
import { renderVideo } from '../../workers/video-studio/engine.mjs';

register();
const { newVideoFromTemplate } = await import('../../shared/video-studio/templates.ts');
const { buildVideoTimeline } = await import('../../shared/video-studio/model.ts');
const { resolveVideoLabel, adaptVideoLabel } = await import('../../shared/video-studio/labels.ts');
const { prepareVideoImage } = await import('../../server/utils/video-studio/images.ts');

const owner = 'eb847e8e-7c19-4bee-8042-376528ce6192';
const slug = process.env.SLUG;
const ids = JSON.parse(await readFile('output/campanhas-magnific-2026-10-06/ids.json', 'utf8'));
const recipeId = `flyer-${ids[slug].projectId}`;
const dir = resolve(`output/campanhas-magnific-2026-10-06/out/${slug}/video`);
const productsRoot = 'output/rodrigues-carrinho-cheio-2026-10-05';
await mkdir(dir, { recursive: true });

const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION, credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } });
const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL });
await db.connect();
let profile, labelRows;
try {
  profile = (await db.query('select business_profile from profiles where id=$1', [owner])).rows[0].business_profile;
  // Mesma consulta de listVideoLabels: etiquetas da conta e globais.
  labelRows = (await db.query(`SELECT DISTINCT ON (coalesce(template_key,id)) coalesce(template_key,id) id,name,"group" FROM public.label_templates
    WHERE (user_id=$1 OR user_id IS NULL) ORDER BY coalesce(template_key,id),CASE WHEN user_id=$1 THEN 0 ELSE 1 END,updated_at DESC`, [owner])).rows;
} finally { await db.end(); }
const labels = labelRows.map(adaptVideoLabel).filter(Boolean);

// Logo do perfil, como o app usa (sem alterar o arquivo original).
const logoObj = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: profile.logo }));
// Mesmo tratamento de /api/videos/brand: recorta a margem transparente e limita a 1000 px.
await sharp(Buffer.from(await logoObj.Body.transformToByteArray())).trim({ threshold: 15 }).resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).png().toFile(`${dir}/brand-logo.png`);
s3.destroy();

// Quatro ofertas com foto do encarte Carrinho Cheio.
const products = JSON.parse(await readFile(`${productsRoot}/products.json`, 'utf8'));
const picked = ['p02', 'p06', 'p03', 'p01'].map(id => products.find(p => p.id === id));
const offers = [];
for (const p of picked) {
  const out = `${dir}/offer-${p.id}.png`;
  // Mesmo tratamento do app ao adicionar a foto no vídeo: remoção de fundo ligada por padrão.
  const img = await prepareVideoImage(await readFile(`${productsRoot}/assets/${p.id}.webp`), { removeBackground: true });
  await writeFile(out, img.bytes);
  offers.push({ id: `offer-${p.id}`, name: p.name, price: p.price, unit: 'UN', image: `offer-${p.id}`, condition: '', imageAspectRatio: img.aspectRatio });
}

const document = newVideoFromTemplate(recipeId);
document.brand = { ...document.brand, name: 'Supermercado Rodrigues', logo: 'brand-logo', instagram: profile.instagram || '', whatsapp: profile.whatsapp || '', address: profile.address || 'Rua da Loja, 100 - Centro' };
document.offers = offers;
// Período estruturado com mês por extenso, como o usuário escolhe no app.
document.validityMode = 'date_range';
document.validityRange = { start: '2026-10-02', end: '2026-10-03' };
document.validityDateFormat = 'long';
// Variação por oferta com semente fixa (demonstração reproduzível) e cortes no ritmo.
document.motionVariation = 'varied';
document.variationSeed = 2026;
document.beatSync = true;
// Documento usado no render, para gravar o projeto de vídeo (persist-extras.mjs).
await writeFile(`${dir}/document.json`, JSON.stringify(document, null, 1));
if (process.argv.includes('--doc')) process.exit(0);
const media = Object.fromEntries([document.brand.logo, ...offers.map(o => o.image)].map(id => [id, `${id}.png`]));
const label = resolveVideoLabel(labels, recipeId);
// Demonstração com música da biblioteca curada (ainda não publicada): DEMO_MUSIC=arquivo DEMO_BPM DEMO_OFFSET DEMO_TAG.
let demoMusic;
if (process.env.DEMO_MUSIC) {
  const { execFileSync } = await import('node:child_process');
  // Começa na primeira batida para alinhar com o quadro 0 (mesmo efeito do startFrom do catálogo).
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(process.env.DEMO_OFFSET || 0), '-i', process.env.DEMO_MUSIC, '-t', '40', '-af', 'loudnorm=I=-16:TP=-1.5', `${dir}/demo-music.mp3`]);
  demoMusic = 'demo-music.mp3';
  document.audio.music = 'retail-drive';
}
const { snapScenesToBeats } = await import('../../shared/video-studio/music-tempo.ts');
let scenes = buildVideoTimeline({ ...document, beatSync: !process.env.DEMO_MUSIC });
if (process.env.DEMO_MUSIC) {
  const frames = snapScenesToBeats(scenes.map(s => s.frames), Number(process.env.DEMO_BPM), 30 * 30 - 2, 30, false, scenes.map((_, i) => i > 0 && i < scenes.length - 1 ? 150 : Infinity));
  let from = 0; scenes = scenes.map((s, i) => { const r = { ...s, from, frames: frames[i] }; from += frames[i]; return r; });
}
console.log('etiqueta:', label?.name, '| duração:', document.duration, 's | cenas:', scenes.map(s => `${s.id}@${s.from}+${s.frames}`).join(' '));

// Cenas em quadros: abertura, primeira oferta (com preço já em cena) e encerramento.
const total = Math.max(...scenes.map(s => s.from + s.frames));
const marks = { intro: Math.round(scenes[0].frames * .7), offer: scenes[1].from + Math.round(scenes[1].frames * .6), outro: total - 30 };
console.log('quadros:', total, JSON.stringify(marks));

// Modo de conferência: quadros avulsos de um formato (still-frames.mjs).
if (globalThis.__STILL_ONLY__) {
  const { format, frames } = globalThis.__STILL_ONLY__;
  for (const frame of frames) await renderVideo({ document, label, format, media, scenes }, dir, `${dir}/frame-${format}-${frame}.png`, () => {}, { frame, scale: .5 });
  console.log('quadros', format, frames.join(','));
}

for (const format of ['vertical', 'horizontal']) {
  const props = { document, label, format, media, scenes, ...(demoMusic ? { music: demoMusic } : {}) };
  if (process.argv.includes('--stills')) {
    for (const [name, frame] of Object.entries(marks)) {
      await renderVideo(props, dir, `${dir}/still-${format}-${name}.png`, () => {}, { frame, scale: .5 });
      console.log('still', format, name, frame);
    }
  }
  if (process.argv.includes('--mp4')) {
    let last = 0;
    if (process.env.DEMO_FORMAT && process.env.DEMO_FORMAT !== format) continue;
    const details = await renderVideo(props, dir, `${dir}/${slug}-${format}.mp4`, p => { if (p - last >= .1) { last = p; console.log(format, Math.round(p * 100) + '%'); } });
    console.log('mp4', format, Number(details.format?.duration).toFixed(2) + 's');
  }
}
