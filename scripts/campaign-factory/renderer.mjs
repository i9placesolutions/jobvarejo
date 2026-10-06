import http from 'node:http';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = 'output/campanhas-magnific-2026-10-06';
const page = `<canvas id="canvas"></canvas><script type="module">
import { compactBusinessFooter, createFooterPaymentGroup, layoutOfferValidityBanner, applyLogoPreferenceToFabric, restoreCanvasStickerOutlines } from '/runtime.mjs';
import * as fabric from '/fabric.mjs';
const { StaticCanvas } = fabric;
const fonts = [['Barlow','Barlow-ExtraBold.ttf','800'],['Barlow','Barlow-Bold.ttf','700'],['Barlow','Barlow-SemiBold.ttf','600'],['Barlow Condensed','BarlowCondensed-ExtraBold.ttf','800'],['Barlow Condensed','BarlowCondensed-SemiBold.ttf','600']];
const LONG_ADDRESS = 'Avenida Principal do Comércio, número 12345, Quadra 99, Setor Residencial Jardim das Palmeiras, Rio Verde - Goiás';
window.__logoPreference = { backdrop: 'none', outline: true, outlineColor: '#FFFFFF', outlineWidth: 4, outlineMode: 'outside', outlineOpacity: 1 };
window.render = async (json, w, h, scenario = 'all') => {
  for (const [n, f, weight, extra] of fonts) { const face = new FontFace(n, 'url(/font/' + encodeURIComponent(f) + ')', { weight, ...(extra || {}) }); await face.load(); document.fonts.add(face); }
  await document.fonts.ready;
  const original = JSON.parse(JSON.stringify(json));
  const canvas = new StaticCanvas('canvas', { width: w, height: h, renderOnAddRemove: false });
  await canvas.loadFromJSON(json);
  const empty = scenario === 'empty';
  for (const o of canvas.getObjects()) {
    const f = o.businessProfileField;
    if (!f || f === 'logo' || f === 'footerPaymentImages') continue;
    const off = empty || (scenario === 'payment-only' && ['address', 'whatsapp'].includes(f)) || (scenario === 'no-social' && ['instagram', 'facebook'].includes(f)) || (scenario === 'instagram-only' && f === 'facebook');
    if (off) o.set({ text: '', visible: false });
    if (scenario === 'long' && f === 'address') o.set('text', LONG_ADDRESS);
    if (scenario === 'long' && f === 'instagram') o.set('text', '@SUPERMERCADO.RODRIGUES.OFERTAS.REGIONAL');
    if (scenario === 'long' && f === 'facebook') o.set('text', '@SUPERMERCADO.RODRIGUES.OFERTAS.REGIONAL');
  }
  if (scenario === 'long') { const d = canvas.getObjects().find(o => o.quickDataField === 'validity'); d?.set('text', '28 DE SETEMBRO A 12 DE OUTUBRO'); }
  const payment = canvas.getObjects().find(o => o.businessProfileField === 'footerPaymentImages');
  const noCards = empty;
  if (payment) payment.set({ visible: !noCards });
  compactBusinessFooter(canvas.getObjects());
  if (payment) {
    const values = noCards ? [] : ['brand:cartao-82', 'brand:cartao-81', 'brand:cartao-84', 'brand:cartao-80', 'brand:cartao-79', 'brand:cartao-86'];
    const group = await createFooterPaymentGroup(fabric, payment, values);
    group.set({ visible: !noCards });
    const index = canvas.getObjects().indexOf(payment); canvas.remove(payment); canvas.insertAt(index, group);
  }
  compactBusinessFooter(canvas.getObjects());
  layoutOfferValidityBanner(canvas.getObjects());
  for (const o of canvas.getObjects()) if (o.isProductZone) o.visible = false;
  // Só na prévia: aplica a preferência de logo do perfil (como o app faz), sem alterar o JSON salvo.
  if (window.__logoPreference) for (const o of canvas.getObjects()) if (o.quickLogoUseProfileInTemplate) applyLogoPreferenceToFabric(o, window.__logoPreference);
  restoreCanvasStickerOutlines(canvas, () => document.createElement('canvas'));
  canvas.renderAll();
  const png = canvas.toDataURL({ format: 'png', multiplier: 1 });
  const keys = ['left','top','width','height','scaleX','scaleY','originX','originY','visible','fontSize','text','lineHeight','dynamicFieldHeight','dynamicFieldBaseFontSize','dynamicFieldAutoFitFontSize','dynamicFieldAutoHeight','footerPaymentWidth','footerPaymentHeight'];
  original.objects = original.objects.map(saved => {
    const live = canvas.getObjects().find(o => o._customId === saved._customId);
    if (!live || saved.isProductZone || saved.isFrame) return saved;
    if (saved.businessProfileField === 'footerPaymentImages') return live.toObject(['_customId','parentFrameId','_frameClipOwner','name','layerName','businessProfileField','quickFieldEnabled','footerPaymentWidth','footerPaymentHeight','__originalSrc']);
    for (const k of keys) if (live[k] !== undefined) saved[k] = live[k];
    return saved;
  });
  const normalize = o => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && v.startsWith('http://127.0.0.1:')) { const u = new URL(v); o[k] = u.pathname + u.search; } else if (v && typeof v === 'object') normalize(v); } };
  normalize(original);
  const box = n => { const o = canvas.getObjects().find(x => x.name === n); if (!o || o.visible === false) return null; const b = o.getBoundingRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; };
  const visible = canvas.getObjects().filter(o => o.visible !== false).map(o => o.name);
  const boxes = Object.fromEntries(['footer-dynamic-whatsapp','footer-dynamic-address','footer-payment-images','header-instagram','header-facebook','header-validity','validity-heading','stock-validity','footer-premium-background','header-social-background','reference-validity-stock-band','header-logo-card'].map(n => [n, box(n)]));
  canvas.dispose();
  return { png, canvasJson: JSON.stringify(original), checks: { scenario, visible, boxes } };
};
</script>`;

export async function renderer(get) {
  const srv = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://local');
      const js = async file => { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(file)); };
      if (u.pathname === '/runtime.mjs') return js(`${root}/runtime.mjs`);
      if (u.pathname === '/fabric.mjs') return js('node_modules/fabric/dist/index.min.mjs');
      if (u.pathname.startsWith('/cartoes/')) return res.end(await fs.readFile('public' + u.pathname));
      if (u.pathname === '/api/storage/p') return res.end(await get(u.searchParams.get('key')));
      if (u.pathname.startsWith('/font/')) return res.end(await fs.readFile('public/art-studio/fonts/' + decodeURIComponent(u.pathname.split('/').at(-1))));
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page);
    } catch (e) { res.writeHead(500).end(String(e.message)); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const profile = await fs.mkdtemp(join(tmpdir(), 'campanhas-magnific-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((ok, no) => { let out = ''; chrome.stderr.on('data', b => { out += b; const m = out.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); }); chrome.on('error', no); });
  const pages = await fetch('http://127.0.0.1:' + new URL(endpoint).port + '/json/list').then(r => r.json());
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const calls = new Map();
  ws.addEventListener('message', e => { const d = JSON.parse(e.data), c = calls.get(d.id); if (c) { calls.delete(d.id); d.error ? c.no(d.error) : c.ok(d.result); } });
  const call = (method, params = {}) => new Promise((ok, no) => { calls.set(++id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
  await call('Page.navigate', { url: 'http://127.0.0.1:' + srv.address().port });
  for (let i = 0; i < 100; i++) { if ((await call('Runtime.evaluate', { expression: 'typeof window.render', returnByValue: true })).result?.value === 'function') break; await new Promise(r => setTimeout(r, 100)); }
  return {
    async render(c, w, h, scenario = 'all') {
      const r = await call('Runtime.evaluate', { expression: `window.render(${JSON.stringify(c)},${w},${h},${JSON.stringify(scenario)})`, awaitPromise: true, returnByValue: true });
      if (!r.result?.value?.png?.startsWith('data:image/png')) throw Error(JSON.stringify(r.exceptionDetails || r.result));
      return { png: Buffer.from(r.result.value.png.split(',')[1], 'base64'), canvas: JSON.parse(r.result.value.canvasJson), checks: r.result.value.checks };
    },
    async close() { ws.close(); chrome.kill(); await new Promise(r => srv.close(r)); await fs.rm(profile, { recursive: true, force: true }).catch(() => {}); }
  };
}
