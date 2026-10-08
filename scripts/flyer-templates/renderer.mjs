// Renderizador de encartes (scripts): Chrome headless com o Fabric do app, o motor de cards do Editor
// Rápido (workers/whatsapp-creation/native-layout.js) e as rotinas de rodapé/validade do app.
// Diferente do worker do WhatsApp, cada zona recebe vários produtos (necessário para "Setores").
import http from 'node:http';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Fontes e runtime ficam ao lado deste arquivo; o runtime é compilado por ensureRuntime().
const root = 'scripts/flyer-templates';
export const RUNTIME_OUT = 'output/.flyer-templates-runtime.mjs';
const FONT_DIR = 'public/art-studio/fonts';

const page = fonts => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}</style></head><body>
<canvas id="canvas"></canvas>
<script src="/fabric.js"></script>
<script src="/native.js"></script>
<script type="module">
import { compactBusinessFooter, createFooterPaymentGroup, layoutOfferValidityBanner, layoutInlineFooterValidity, applyLogoPreferenceToFabric, restoreCanvasStickerOutlines } from '/runtime.mjs';
const fabric = window.fabric;
if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const KEYS = ['name','isProductZone','isGridZone','isFrame','_customId','_zoneGlobalStyles','_zoneStateSnapshot','_zonePadding','_zoneTemplateSnapshot','_zoneTemplateSnapshotId','structureByProductCount','structureByProductCountByPreviewFormat','structureVariantsByProductCountByPreviewFormat','structureVariantByProductCountByPreviewFormat','quickValidityLayout','dynamicFieldBaseFontSize','parentFrameId','footerLayout','footerStack','footerColumnWeights','footerPaymentColumns','footerPaymentTile','footerPaymentWidth','footerPaymentHeight','businessProfileField','quickFieldEnabled','quickLogoUseProfileInTemplate'];
window.render = async (json, w, h, format, productsByZone) => {
  await document.fonts.ready;
  const source = JSON.parse(JSON.stringify(json));
  const canvas = new fabric.StaticCanvas(document.getElementById('canvas'), { width: w, height: h, renderOnAddRemove: false, enableRetinaScaling: false });
  await canvas.loadFromJSON(source);
  const all = canvas.getObjects();
  all.forEach((o, i) => { const saved = source.objects[i] || {}; for (const k of KEYS) if (saved[k] !== undefined) o[k] = saved[k]; });
  // Cartões aceitos (6 bandeiras) e organização do rodapé/validade, como no app.
  const payment = all.find(o => o.businessProfileField === 'footerPaymentImages');
  // Mesma ordem do app: organiza o rodapé, cria o grupo no tamanho final do bloco e organiza de novo.
  compactBusinessFooter(canvas.getObjects());
  if (payment) {
    const group = await createFooterPaymentGroup(fabric, payment, ['brand:cartao-82','brand:cartao-81','brand:cartao-84','brand:cartao-80','brand:cartao-79','brand:cartao-86']);
    const index = canvas.getObjects().indexOf(payment); canvas.remove(payment); canvas.insertAt(index, group);
  }
  compactBusinessFooter(canvas.getObjects());
  layoutOfferValidityBanner(canvas.getObjects());
  // Mesma diagramação da validade que o editor aplica ao abrir/exportar.
  layoutInlineFooterValidity(canvas.getObjects());
  for (const o of canvas.getObjects()) if (o.quickLogoUseProfileInTemplate) applyLogoPreferenceToFabric(o, { backdrop: 'none', outline: true, outlineColor: '#FFFFFF', outlineWidth: 4, outlineMode: 'outside', outlineOpacity: 1 });
  restoreCanvasStickerOutlines(canvas, () => document.createElement('canvas'));
  // Geometria final do rodapé, como o app organiza, para gravar no modelo. Só objetos do rodapé:
  // logo, selo e produtos nunca são reescritos por aqui.
  const isFooterPart = o => /^footer-/.test(String(o?.name || '')) || ['icon-whatsapp', 'icon-address'].includes(o?.name) ||
    ['whatsapp', 'address', 'footerPaymentImages'].includes(o?.businessProfileField);
  const GEO = ['left','top','width','height','scaleX','scaleY','originX','originY','visible','fontSize','text','lineHeight','dynamicFieldHeight','dynamicFieldBaseFontSize','dynamicFieldAutoFitFontSize','dynamicFieldAutoHeight','footerPaymentWidth','footerPaymentHeight'];
  const persisted = JSON.parse(JSON.stringify(json));
  persisted.objects = persisted.objects.map(saved => {
    if (!isFooterPart(saved)) return saved;
    const live = canvas.getObjects().find(o => o._customId && o._customId === saved._customId);
    if (!live) return saved;
    if (saved.businessProfileField === 'footerPaymentImages') {
      const object = live.toObject(['_customId','parentFrameId','_frameClipOwner','name','layerName','businessProfileField','quickFieldEnabled','footerPaymentWidth','footerPaymentHeight','footerPaymentColumns','footerPaymentTile','__originalSrc']);
      const strip = node => { for (const [k, v] of Object.entries(node)) { if (typeof v === 'string' && v.startsWith('http://127.0.0.1:')) node[k] = v.slice(new URL(v).origin.length); else if (v && typeof v === 'object') strip(v); } };
      strip(object);
      return object;
    }
    for (const k of GEO) if (live[k] !== undefined) saved[k] = live[k];
    return saved;
  });
  // Produtos: grade nativa (calculateManualProductSlots) e card nativo (createManualProductCard) por zona.
  const zones = canvas.getObjects().filter(o => o.isProductZone || o.isGridZone).sort((a, b) => a.top - b.top || a.left - b.left);
  // Mesmos nomes de formato de receita do app (utils/product-zone-structure).
  const preview = { stories: 'story', square: 'post', print: 'a4', tv: 'banner' }[format] || format;
  const slotsReport = [];
  for (const zone of zones) {
    const products = productsByZone[zone._customId] || [];
    // Modelo sem produtos (biblioteca): a zona é guia do editor e não aparece na exportação.
    if (!products.length) { zone.visible = false; continue; }
    const bounds = zone.getBoundingRect();
    const slots = JobVarejoNative.calculateManualProductSlots(zone, products.length, preview, bounds);
    zone.visible = false;
    const styles = zone._zoneGlobalStyles || {};
    const palette = { ...(styles.templateProductPalette || {}), ...(styles.productPalette || {}) };
    const templates = source.__labelTemplates || [];
    const labelId = String(styles.splashTemplateId || zone._zoneTemplateSnapshotId || '').trim();
    const template = templates.find(t => String(t.id) === labelId);
    const savedLabel = template?.group || zone._zoneTemplateSnapshot || zone._zoneStateSnapshot?.labelTemplate?.snapshot;
    for (let i = 0; i < products.length; i++) {
      const p = products[i], s = slots[i];
      const cardColor = s.highlighted ? (palette.highlightCardColor || '#ffffff') : (palette.cardColor || '#ffffff');
      const card = await JobVarejoNative.createManualProductCard(fabric, {
        ...p, name: styles.prodNameTransform === 'upper' ? p.name.toLocaleUpperCase('pt-BR') : p.name,
        limit: '', autoFillImages: true, imageFillMinimum: 2, zoneInstanceId: zone._customId
      }, s.left + s.width / 2, s.top + s.height / 2, s.width, s.height, zone._customId,
        savedLabel ? { ...(template || {}), id: labelId, group: savedLabel } : undefined,
        { ...styles, __refCellW: s.refCellWidth, __refCellH: s.refCellHeight, cardLayout: styles.cardLayout,
          productPalette: { ...palette, cardColor, prodNameColor: palette.prodNameColor || '#111111' } });
      card.set({ isProductCard: true, parentZoneId: zone._customId, _zoneOrder: i });
      canvas.add(card);
      slotsReport.push({ zone: zone._customId, i, highlighted: !!s.highlighted, w: Math.round(s.width), h: Math.round(s.height) });
    }
  }
  JobVarejoNative.harmonizeProductCardTypography(canvas.getObjects().filter(o => o.isProductCard));
  canvas.renderAll();
  const png = canvas.toDataURL({ format: 'png', multiplier: 1, enableRetinaScaling: false });
  const box = n => { const o = canvas.getObjects().find(x => x.name === n); if (!o || o.visible === false) return null; const b = o.getBoundingRect(); return { left: Math.round(b.left), top: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; };
  const checks = Object.fromEntries(['footer-dynamic-whatsapp','footer-dynamic-address','footer-payment-images','header-instagram','header-validity','stock-validity','header-logo-slot'].map(n => [n, box(n)]));
  canvas.dispose();
  return { png, checks, slots: slotsReport, persisted: JSON.stringify(persisted) };
};
window.__ready = true;
</script></body></html>`;

// files: Map chave→arquivo local; fetchKey (opcional): busca a chave no Wasabi quando não está no Map.
export async function renderer(files, fetchKey = null) {
  const fontList = JSON.parse(await fs.readFile(`${root}/fonts.json`, 'utf8'));
  const css = fontList.map(f => `@font-face{font-family:${JSON.stringify(f.family)};font-style:${f.style};font-weight:${f.weight};font-display:block;src:url(/font/${encodeURIComponent(f.file)}) format('truetype')}`).join('\n');
  const srv = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://local');
      const send = async (file, type) => { res.setHeader('Content-Type', type); res.end(await fs.readFile(file)); };
      if (u.pathname === '/fabric.js') return send('node_modules/fabric/dist/index.min.js', 'text/javascript');
      if (u.pathname === '/native.js') return send('workers/whatsapp-creation/native-layout.js', 'text/javascript');
      if (u.pathname === '/runtime.mjs') return send(RUNTIME_OUT, 'text/javascript');
      if (u.pathname.startsWith('/cartoes/')) return send('public' + u.pathname, 'image/png');
      if (u.pathname.startsWith('/font/')) return send(`${FONT_DIR}/${decodeURIComponent(u.pathname.slice(6))}`, 'font/ttf');
      if (u.pathname === '/api/storage/p') {
        const key = u.searchParams.get('key'), f = files.get(key);
        if (f) return send(f, f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.webp') ? 'image/webp' : 'image/png');
        if (!fetchKey) throw Error('arquivo ausente: ' + key);
        const { body, type } = await fetchKey(key);
        res.setHeader('Content-Type', type); return res.end(body);
      }
      if (u.pathname.startsWith('/local/')) return send(decodeURIComponent(u.pathname.slice(7)), 'application/octet-stream');
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page(css));
    } catch (e) { res.writeHead(500).end(String(e.message)); }
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const profile = await fs.mkdtemp(join(tmpdir(), 'estruturas-'));
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((ok, no) => { let out = ''; chrome.stderr.on('data', b => { out += b; const m = out.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); }); chrome.on('error', no); });
  const pages = await fetch('http://127.0.0.1:' + new URL(endpoint).port + '/json/list').then(r => r.json());
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const calls = new Map(); const logs = [];
  ws.addEventListener('message', e => { const d = JSON.parse(e.data); if (d.method === 'Runtime.consoleAPICalled' || d.method === 'Runtime.exceptionThrown') logs.push(JSON.stringify(d.params).slice(0, 400)); const c = calls.get(d.id); if (c) { calls.delete(d.id); d.error ? c.no(d.error) : c.ok(d.result); } });
  const call = (method, params = {}) => new Promise((ok, no) => { calls.set(++id, { ok, no }); ws.send(JSON.stringify({ id, method, params })); });
  await call('Runtime.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:' + srv.address().port });
  for (let i = 0; i < 150; i++) { if ((await call('Runtime.evaluate', { expression: 'window.__ready === true', returnByValue: true })).result?.value) break; await new Promise(r => setTimeout(r, 100)); }
  return {
    async render(canvas, w, h, format, productsByZone) {
      const r = await call('Runtime.evaluate', { expression: `window.render(${JSON.stringify(canvas)},${w},${h},${JSON.stringify(format)},${JSON.stringify(productsByZone)})`, awaitPromise: true, returnByValue: true });
      if (!r.result?.value?.png?.startsWith('data:image/png')) throw Error(JSON.stringify(r.exceptionDetails || r.result).slice(0, 1500) + '\n' + logs.slice(-5).join('\n'));
      return { png: Buffer.from(r.result.value.png.split(',')[1], 'base64'), checks: r.result.value.checks, slots: r.result.value.slots, persisted: JSON.parse(r.result.value.persisted) };
    },
    async close() { ws.close(); chrome.kill(); await new Promise(r => srv.close(r)); await fs.rm(profile, { recursive: true, force: true }).catch(() => {}); }
  };
}
