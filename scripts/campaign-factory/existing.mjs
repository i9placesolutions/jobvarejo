// Junta todos os selos já usados no sistema (catálogo de receitas + cabeçalhos do cartaz) em existing/ para comparação.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
const root = '../..';
const recipes = JSON.parse(await fs.readFile(`${root}/shared/video-studio/generated-flyer-recipes.json`, 'utf8'));
const catalog = JSON.parse(await fs.readFile(`${root}/shared/video-studio/catalog-assets.json`, 'utf8')).assets;
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION, credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } });
await fs.mkdir('existing', { recursive: true });
const seals = [...new Set(recipes.flatMap(r => [r.seal, r.referenceArtwork?.src]).filter(x => x && !x.startsWith('/') && !x.startsWith('http')))];
const index = [];
let miss = 0;
for (const s of seals) {
  const out = `existing/${s.replace(/[^\w.-]+/g, '_')}`;
  if (!existsSync(out)) {
    const local = `${root}/output/video-studio-catalog-source/templates/${s}`;
    if (existsSync(local)) await fs.copyFile(local, out);
    else {
      const entry = catalog[`templates/${s}`];
      if (!entry) { miss++; continue; }
      const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: entry.key }));
      await fs.writeFile(out, Buffer.from(await r.Body.transformToByteArray()));
    }
  }
  index.push({ seal: s, file: out, names: recipes.filter(r => r.seal === s || r.referenceArtwork?.src === s).map(r => r.name) });
}
await fs.writeFile('existing.json', JSON.stringify(index, null, 1));
console.log('selos existentes', index.length, 'sem arquivo', miss);
s3.destroy();
