// Grava as campanhas como modelos (is_template) na conta, com leitura de volta no Wasabi e no banco.
// Uso (na raiz): node --env-file=.env output/campanhas-magnific-2026-10-06/persist.mjs [slug...]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CAMPAIGNS } from './campaigns.mjs';

const root = 'output/campanhas-magnific-2026-10-06';
const only = process.argv.slice(2);
const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL });
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION, credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } });
const sha = b => createHash('sha256').update(b).digest('hex');
const read = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key }))).Body.transformToByteArray());
const put = async (Key, Body, ContentType) => {
  await s3.send(new PutObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key, Body, ContentType }));
  assert.equal(sha(await read(Key)), sha(Body), `Leitura divergente em ${Key}`);
  return { key: Key, bytes: Body.length, sha256: sha(Body) };
};

await db.connect();
const saved = [];
try {
  for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
    const out = `${root}/out/${c.slug}`;
    const { owner, model, formats, prefix, assets, projectId } = JSON.parse(await fs.readFile(`${out}/build-meta.json`, 'utf8'));
    const ids = JSON.parse(await fs.readFile(`${root}/ids.json`, 'utf8'))[c.slug];
    const profile = (await db.query('select id,email from profiles where id=$1', [owner])).rows[0];
    assert.equal(profile?.email, 'rafael@jobvarejo.com.br');
    const exists = (await db.query('select 1 from projects where id=$1 and user_id=$2', [projectId, owner])).rowCount === 1;

    const uploads = [];
    for (const a of [assets.seal, ...assets.elements, ...Object.values(assets.bg)]) uploads.push(await put(a.key, await fs.readFile(a.file), a.contentType));
    const savedAt = Date.now(), pages = [];
    for (const f of formats) {
      const canvas = JSON.parse(await fs.readFile(`${out}/${f.id}.json`, 'utf8'));
      const dataKey = `${prefix}/pages/${f.id}.json.gz`, thumbKey = `${prefix}/pages/${f.id}.png`;
      uploads.push(await put(dataKey, gzipSync(Buffer.from(JSON.stringify(canvas))), 'application/octet-stream'));
      uploads.push(await put(thumbKey, await fs.readFile(`${out}/${f.id}.png`), 'image/png'));
      const stored = await read(dataKey);
      assert.deepEqual(JSON.parse(gunzipSync(stored)), canvas);
      pages.push({ id: ids.formats[f.id].page, name: `${model.name} · ${f.id}`, type: 'RETAIL_OFFER', width: f.width, height: f.height,
        canvasDataPath: dataKey, thumbnailUrl: thumbKey, thumbnailPath: thumbKey, canvasSavedAt: savedAt,
        templateModelId: model.id, templateModelName: model.name, templateThemeId: model.id, templateThemeName: model.name,
        templateFormatId: f.id, templateFormatLabel: f.label, templateCompositionManaged: true });
    }
    const config = { version: 1, category: 'Supermercado', subcategory: model.name.split(' — ')[0], models: [model], defaultModelId: model.id, defaultFormatId: 'feed',
      formatIds: pages.map(p => p.templateFormatId), pageBlueprints: pages.map(({ id, ...p }) => ({ ...p, sourcePageId: id })),
      assets: { seal: assets.seal.key, elements: assets.elements.map(e => e.key), portrait: assets.bg.feed.key, wide: assets.bg.tv.key },
      source: { magnific: { seal: c.seal, background: c.bg, elements: c.elements, video: c.video } } };
    if (exists) await db.query('update projects set name=$3, canvas_data=$4::jsonb, preview_url=$5, template_config=$6::jsonb, is_template=true where id=$1 and user_id=$2',
      [projectId, owner, model.name, JSON.stringify(pages), pages[0].thumbnailUrl, JSON.stringify(config)]);
    else await db.query('insert into projects(id,user_id,name,canvas_data,preview_url,is_template,template_config,is_shared) values($1,$2,$3,$4::jsonb,$5,true,$6::jsonb,false)',
      [projectId, owner, model.name, JSON.stringify(pages), pages[0].thumbnailUrl, JSON.stringify(config)]);
    const after = (await db.query('select canvas_data,template_config,is_template from projects where id=$1 and user_id=$2', [projectId, owner])).rows[0];
    assert.deepEqual(after.canvas_data, pages);
    assert.deepEqual(after.template_config, config);
    assert.equal(after.is_template, true);
    saved.push({ slug: c.slug, projectId, name: model.name, pages: pages.length, uploads: uploads.length, created: !exists });
    console.log(exists ? 'ATUALIZADO' : 'CRIADO', c.slug, projectId, pages.length, 'páginas', uploads.length, 'arquivos');
  }
} finally { await db.end(); s3.destroy(); }
await fs.writeFile(`${root}/saved.json`, JSON.stringify({ saved, verifiedAt: new Date().toISOString() }, null, 2));
