// Grava, por campanha, o que completa o pacote no padrão das coleções do sistema:
// 8 cartazes (cartazista_designs), projeto de vídeo (video_studio_projects) com os 2 renders (video_studio_assets)
// e o vínculo no template_config do encarte. Releitura no Wasabi e no banco. Reexecução atualiza os mesmos IDs.
// Uso (na raiz): node --env-file=.env output/campanhas-magnific-2026-10-06/persist-extras.mjs [slug...]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CAMPAIGNS } from './campaigns.mjs';

const root = 'output/campanhas-magnific-2026-10-06';
const owner = 'eb847e8e-7c19-4bee-8042-376528ce6192';
const POSTERS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'banner-2m'];
const only = process.argv.slice(2);
const idsFile = `${root}/ids.json`;
const ids = JSON.parse(await fs.readFile(idsFile, 'utf8'));
const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL });
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION, credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } });
const sha = b => createHash('sha256').update(b).digest('hex');
const read = async Key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key }))).Body.transformToByteArray());
const put = async (Key, Body, ContentType) => {
  await s3.send(new PutObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key, Body, ContentType }));
  assert.equal(sha(await read(Key)), sha(Body), `Leitura divergente em ${Key}`);
  return { key: Key, bytes: Body.length };
};
const probe = f => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f]).toString());

await db.connect();
const report = [];
try {
  assert.equal((await db.query('select email from profiles where id=$1', [owner])).rows[0]?.email, 'rafael@jobvarejo.com.br');
  // Mídias compartilhadas dos vídeos (logo e fotos das ofertas), cadastradas uma vez como assets de imagem.
  ids._media ??= {};
  const sample = `${root}/out/${CAMPAIGNS[0].slug}/video`;
  for (const name of ['brand-logo', 'offer-p02', 'offer-p06', 'offer-p03', 'offer-p01']) {
    const id = ids._media[name] ??= randomUUID(), key = `video-studio/${owner}/assets/${id}.png`, file = `${sample}/${name}.png`;
    const bytes = await fs.readFile(file), meta = await sharp(bytes).metadata();
    await put(key, bytes, 'image/png');
    await db.query(`insert into video_studio_assets(id,user_id,kind,name,storage_key,content_type,bytes,metadata) values($1,$2,'image',$3,$4,'image/png',$5,$6::jsonb)
      on conflict (id) do update set storage_key=excluded.storage_key,bytes=excluded.bytes,metadata=excluded.metadata`,
      [id, owner, name === 'brand-logo' ? 'logo.png' : name, key, bytes.length, JSON.stringify({ width: meta.width, height: meta.height, autoTrim: true })]);
  }
  await fs.writeFile(idsFile, JSON.stringify(ids, null, 2));

  for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
    const id = ids[c.slug], projectId = id.projectId, dir = `${root}/out/${c.slug}`, prefix = `projects/${owner}/${projectId}/revision-2`;
    id.videoId ??= randomUUID(); id.renders ??= {}; id.posters ??= {};
    for (const f of POSTERS) id.posters[f] ??= randomUUID();
    for (const f of ['vertical', 'horizontal']) id.renders[f] ??= randomUUID();
    await fs.writeFile(idsFile, JSON.stringify(ids, null, 2));

    // Cartazes: documento do Cartazista + PNG de prévia guardados junto do encarte.
    const posters = [];
    for (const f of POSTERS) {
      const d = JSON.parse(await fs.readFile(`${dir}/cartazes/cartaz-${f}.json`, 'utf8'));
      d.name = `${c.name} — ${f.toUpperCase()}`;
      assert.equal(d.settings.header.id, projectId);
      await put(`${prefix}/posters/${f}.json`, Buffer.from(JSON.stringify(d)), 'application/json');
      await put(`${prefix}/posters/${f}.png`, await fs.readFile(`${dir}/cartazes/cartaz-${f}.png`), 'image/png');
      posters.push({ id: id.posters[f], format: f, document: d });
    }
    // Vídeo: documento com as mídias cadastradas + renders verificados.
    const document = JSON.parse(await fs.readFile(`${dir}/video/document.json`, 'utf8'));
    document.id = id.videoId;
    document.brand.logo = ids._media['brand-logo'];
    for (const o of document.offers) o.image = ids._media[o.image];
    assert(document.offers.every(o => o.image) && document.brand.logo, 'mídia sem cadastro');
    const renders = [];
    for (const f of ['vertical', 'horizontal']) {
      const file = `${dir}/video/${c.slug}-${f}.mp4`, info = probe(file), key = `video-studio/${owner}/assets/${id.renders[f]}.mp4`;
      const up = await put(key, await fs.readFile(file), 'video/mp4');
      renders.push({ id: id.renders[f], format: f, key, bytes: up.bytes, duration: Number(info.format.duration), width: info.streams[0].width, height: info.streams[0].height });
    }

    await db.query('begin');
    try {
      for (const p of posters) await db.query(`insert into cartazista_designs(id,owner_id,name,state) values($1,$2,$3,$4::jsonb)
        on conflict (id) do update set name=excluded.name,state=excluded.state,revision=cartazista_designs.revision+1,updated_at=now()`, [p.id, owner, p.document.name, JSON.stringify(p.document)]);
      await db.query(`insert into video_studio_projects(id,user_id,title,document,script_source) values($1,$2,$3,$4::jsonb,'')
        on conflict (id) do update set title=excluded.title,document=excluded.document,revision=video_studio_projects.revision+1,updated_at=now()`, [id.videoId, owner, c.name, JSON.stringify(document)]);
      for (const r of renders) await db.query(`insert into video_studio_assets(id,user_id,kind,name,storage_key,content_type,bytes,duration,metadata) values($1,$2,'render',$3,$4,'video/mp4',$5,$6,$7::jsonb)
        on conflict (id) do update set storage_key=excluded.storage_key,bytes=excluded.bytes,duration=excluded.duration,metadata=excluded.metadata`,
        [r.id, owner, `${c.name} — ${r.format}`, r.key, r.bytes, r.duration, JSON.stringify({ projectId: id.videoId, format: r.format, verified: true, width: r.width, height: r.height })]);
      const config = (await db.query('select template_config from projects where id=$1 and user_id=$2', [projectId, owner])).rows[0]?.template_config;
      assert(config, `encarte ${c.slug} não encontrado`);
      config.video = { projectId: id.videoId, recipeId: `flyer-${projectId}`, formats: ['vertical', 'horizontal'] };
      config.posters = posters.map(p => ({ id: p.id, format: p.format }));
      await db.query('update projects set template_config=$3::jsonb where id=$1 and user_id=$2', [projectId, owner, JSON.stringify(config)]);
      await db.query('commit');
    } catch (e) { await db.query('rollback'); throw e; }

    // Releitura: tudo que foi gravado precisa voltar igual do banco.
    const back = (await db.query('select id,state from cartazista_designs where owner_id=$1 and id=any($2::uuid[])', [owner, posters.map(p => p.id)])).rows;
    assert.equal(back.length, 8);
    for (const p of posters) assert.deepEqual(back.find(r => r.id === p.id).state, p.document);
    assert.deepEqual((await db.query('select document from video_studio_projects where id=$1 and user_id=$2', [id.videoId, owner])).rows[0].document, document);
    assert.equal((await db.query("select count(*)::int n from video_studio_assets where user_id=$1 and kind='render' and metadata->>'projectId'=$2", [owner, id.videoId])).rows[0].n, 2);
    report.push({ slug: c.slug, projectId, videoId: id.videoId, posters: posters.length, renders: renders.map(r => `${r.format} ${r.width}x${r.height} ${r.duration.toFixed(1)}s`) });
    console.log('GRAVADO', c.slug, '8 cartazes, vídeo', id.videoId, renders.map(r => r.format).join('+'));
  }
} finally { await db.end(); s3.destroy(); }
await fs.writeFile(`${root}/saved-extras.json`, JSON.stringify({ report, verifiedAt: new Date().toISOString() }, null, 2));
