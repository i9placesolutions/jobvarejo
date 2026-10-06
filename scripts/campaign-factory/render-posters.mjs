// Cartazes do Cartazista para cada campanha (A1–A7 padrão + Faixa 2 m), com o próprio código do app:
// createCartazistaDocument + cabeçalho thematic-seal (header-assets.json) + fonte de pincel padrão.
// Uso (na raiz): node output/campanhas-magnific-2026-10-06/render-posters.mjs [slug...]
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CAMPAIGNS, PALETTES } from './campaigns.mjs';

const root = 'output/campanhas-magnific-2026-10-06';
const ids = JSON.parse(await fs.readFile(`${root}/ids.json`, 'utf8'));
const only = process.argv.slice(2);
const FORMATS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'banner-2m'];
const logo = '/output/sextou-ofertas-rodrigues-2026-10-05/video/out/brand-logo.png';

const vite = await createServer({ configFile: false, root: process.cwd(), publicDir: resolve('public'), logLevel: 'error', resolve: { alias: { '~': process.cwd() } }, server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'poster', configureServer(s) { s.middlewares.use((req, res, next) => {
    // Arquivos do catálogo já publicados no Wasabi ficam arquivados localmente fora de public/.
    if (req.url.startsWith('/video-studio/templates/')) {
      const path = decodeURIComponent(req.url.split('?')[0]);
      const archived = `output/video-studio-catalog-source${path.replace('/video-studio', '')}`;
      if (!existsSync(`public${path}`) && existsSync(archived)) { res.setHeader('Content-Type', path.endsWith('.png') ? 'image/png' : 'image/jpeg'); return createReadStream(archived).pipe(res); }
    }
    if (req.url !== '/render') return next();
    res.setHeader('Content-Type', 'text/html');
    res.end(`<script type="module">import{renderCartazistaPng}from'/utils/cartazista/render.ts'
import{createCartazistaDocument,rebuildCartazistaComposition}from'/utils/cartazista/composition.ts'
import assets from '/shared/cartazista/header-assets.json'
window.renderPoster=async(format,f)=>{let d=createCartazistaDocument({formatId:format,modelId:format==='banner-2m'?'banner-2m':'standard',logoSrc:'${logo}'})
const before=structuredClone(d.composition)
d.settings.header={id:f.id,name:f.name,color:f.color,layout:'thematic-seal',...assets[f.id]}
d=rebuildCartazistaComposition(d)
const body=c=>c.layers.filter(l=>!l.id.startsWith('cartaz-campaign-')&&!['cartaz-logo','cartaz-header-brush','cartaz-offer-label','cartaz-logo-backdrop'].includes(l.id))
if(JSON.stringify(body(before))!==JSON.stringify(body(d.composition)))throw Error('Corpo do cartaz alterado')
return {png:await renderCartazistaPng(d.composition),document:JSON.stringify(d)}}</script>`);
  }); } }] });
await vite.listen();
const profile = await fs.mkdtemp(join(tmpdir(), 'campanhas-cartazes-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const endpoint = await new Promise((ok, no) => { let out = ''; chrome.stderr.on('data', b => { out += b; const m = out.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); }); chrome.on('error', no); });
const targets = await fetch('http://127.0.0.1:' + new URL(endpoint).port + '/json/list').then(r => r.json());
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const d = JSON.parse(e.data), p = pending.get(d.id); if (p) { pending.delete(d.id); d.error ? p.no(d.error) : p.ok(d.result); } });
const call = (method, params = {}) => new Promise((ok, no) => { pending.set(++id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
try {
  await call('Page.navigate', { url: 'http://127.0.0.1:' + vite.httpServer.address().port + '/render' });
  for (let i = 0; i < 300; i++) { if ((await call('Runtime.evaluate', { expression: 'typeof window.renderPoster', returnByValue: true })).result?.value === 'function') break; await new Promise(r => setTimeout(r, 200)); }
  for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
    const f = { id: ids[c.slug].projectId, name: c.name, color: PALETTES[c.palette].card[2] };
    const dir = `${root}/out/${c.slug}/cartazes`;
    await fs.mkdir(dir, { recursive: true });
    for (const format of FORMATS) {
      const r = await call('Runtime.evaluate', { expression: `window.renderPoster(${JSON.stringify(format)},${JSON.stringify(f)})`, awaitPromise: true, returnByValue: true });
      if (!r.result?.value?.png?.startsWith('data:image/png')) throw Error(JSON.stringify(r.exceptionDetails || r.result));
      await fs.writeFile(`${dir}/cartaz-${format}.png`, Buffer.from(r.result.value.png.split(',')[1], 'base64'));
      await fs.writeFile(`${dir}/cartaz-${format}.json`, r.result.value.document);
    }
    console.log('cartazes', c.slug);
  }
} finally { ws.close(); chrome.kill(); await vite.close(); }
