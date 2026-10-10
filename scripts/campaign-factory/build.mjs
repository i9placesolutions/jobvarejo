// Gera os 5 formatos de encarte de cada campanha (mesma estrutura dinâmica do Sextou de Ofertas).
// Uso (na raiz do repositório): node --env-file=.env output/campanhas-magnific-2026-10-06/build.mjs [slug...]
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import pg from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { applyLabel, colorFamily, LABEL_POOL } from '../../scripts/flyer-templates/replace-label-lib.mjs';
import { compose } from './compose.mjs';
import { CAMPAIGNS, theme, LOOK, PALETTES } from './campaigns.mjs';
import { renderer } from './renderer.mjs';

const root = 'output/campanhas-magnific-2026-10-06';
const donorRoot = 'output/operacao-fecha-mes-reference-2026-10-01';
const owner = 'eb847e8e-7c19-4bee-8042-376528ce6192';
const formats = [
  { id: 'feed', width: 1080, height: 1350, label: 'Feed 4:5' },
  { id: 'square', width: 1080, height: 1080, label: 'Post 1:1' },
  { id: 'stories', width: 1080, height: 1920, label: 'Story 9:16' },
  { id: 'print', width: 794, height: 1123, label: 'A4' },
  { id: 'tv', width: 1920, height: 1080, label: 'Banner 16:9' }
];
const only = process.argv.slice(2);

// IDs estáveis por campanha (projeto, páginas, quadros e zonas) para regravar sem duplicar.
const idsFile = `${root}/ids.json`;
const allIds = existsSync(idsFile) ? JSON.parse(await fs.readFile(idsFile, 'utf8')) : {};
for (const c of CAMPAIGNS) allIds[c.slug] ??= { projectId: randomUUID(), formats: Object.fromEntries(formats.map(f => [f.id, { page: randomUUID(), frame: randomUUID(), zone: randomUUID() }])) };
await fs.writeFile(idsFile, JSON.stringify(allIds, null, 2));

const url = k => `/api/storage/p?key=${encodeURIComponent(k)}`;
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION, credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } });
const cache = new Map();
const get = async key => {
  if (!cache.has(key)) { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })); cache.set(key, Buffer.from(await r.Body.transformToByteArray())); }
  return cache.get(key);
};

const runtime = await import('./runtime.mjs');
const copy = runtime.splitFooterValidityText({ startDate: '2026-10-01', endDate: '2026-10-02', mode: 'range', whileStocks: true, layout: 'offer-banner', copyStyle: 'padded' });
// Etiqueta de preço por campanha: o doador traz sempre a mesma ("Mês da Economia", reprovada). Cada campanha
// recebe uma etiqueta do banco que combine com a paleta (LOOK[slug].label sobrescreve), alternando entre campanhas.
const labelsDb = await (async () => {
  const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL }); await db.connect();
  try { return (await db.query(`SELECT DISTINCT ON (coalesce(template_key,id)) coalesce(template_key,id) key, name, kind, "group" FROM label_templates
    WHERE (user_id=$1 OR user_id IS NULL) ORDER BY coalesce(template_key,id), CASE WHEN user_id=$1 THEN 0 ELSE 1 END, updated_at DESC`, [owner])).rows; } finally { await db.end(); }
})();
const familyUse = {};
const labelFor = c => {
  const P = PALETTES[c.palette] || {}, key = LOOK[c.slug]?.label;
  const family = colorFamily(P.card?.[2] || P.base, P.accent), pool = LABEL_POOL[family], i = familyUse[family] = (familyUse[family] ?? -1) + 1;
  const label = labelsDb.find(x => x.key === (key || pool[(CAMPAIGNS.indexOf(c) + i) % pool.length]));
  if (!label) throw Error(`Etiqueta não encontrada para ${c.slug}`);
  return label;
};
const donors = Object.fromEntries(await Promise.all(formats.map(async f => [f.id, JSON.parse(await fs.readFile(`${donorRoot}/${f.id}.json`, 'utf8'))])));

const rr = await renderer(get);
try {
  for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
    const ids = allIds[c.slug], dir = `${root}/work/${c.slug}`, out = `${root}/out/${c.slug}`;
    await fs.mkdir(out, { recursive: true });
    const prefix = `projects/${owner}/${ids.projectId}/revision-${process.env.REVISION || 1}`;
    const asset = async (name, file, ext = 'png') => {
      const key = `${prefix}/assets/${name}.${ext}`, buffer = await fs.readFile(`${dir}/${file}`);
      cache.set(key, buffer);
      const meta = await sharp(buffer).metadata();
      return { key, file: `${dir}/${file}`, contentType: ext === 'jpg' ? 'image/jpeg' : 'image/png', url: url(key), meta: { width: meta.width, height: meta.height } };
    };
    const assets = { seal: await asset('seal', 'seal.png'), elements: [], bg: {} };
    // Elementos 3D ficam no fundo desenhado (design.mjs); nenhuma camada extra no encarte.
    for (const f of formats) assets.bg[f.id] = await asset(`background-${f.id}`, `bg-${f.id}.jpg`, 'jpg');
    const model = { id: c.slug, name: c.name }, label = labelFor(c);
    const report = [];
    for (const f of formats) {
      const page = { id: ids.formats[f.id].page, width: f.width, height: f.height, templateFormatId: f.id, templateModelId: model.id, templateModelName: model.name };
      const canvas = applyLabel(compose({ donor: donors[f.id], page, assets, ids: { ...ids.formats[f.id], validity: copy }, theme: theme(c), slug: c.slug, variant: LOOK[c.slug].layout }), label, labelsDb).canvas;
      const result = await rr.render(canvas, f.width, f.height);
      await fs.writeFile(`${out}/${f.id}.json`, JSON.stringify(result.canvas));
      await fs.writeFile(`${out}/${f.id}.png`, result.png);
      report.push({ format: f.id, scenario: 'all', ...result.checks });
      if (process.env.VALIDATE === '1') for (const scenario of ['long', 'empty']) {
        const check = await rr.render(result.canvas, f.width, f.height, scenario);
        await fs.writeFile(`${out}/check-${f.id}-${scenario}.png`, check.png);
        report.push({ format: f.id, ...check.checks });
      }
    }
    await fs.writeFile(`${out}/render-report.json`, JSON.stringify(report, null, 2));
    await fs.writeFile(`${out}/build-meta.json`, JSON.stringify({ owner, model, campaign: c, formats, prefix, assets, copy, projectId: ids.projectId }, null, 2));
    console.log('renderizado', c.slug, '| etiqueta:', label.name);
  }
} finally { await rr.close(); s3.destroy(); }
