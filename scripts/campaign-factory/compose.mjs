import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Paleta vem do tema de cada campanha (campaigns.mjs); a estrutura é a mesma do Sextou de Ofertas.
const CONDENSED = 'Barlow Condensed';
const SANS = 'Barlow';

// Geometria da referência (941×1672) convertida para o Story 1080×1920 (×1,1477).
const REF = {
  seal: { x: 0, y: 0, w: 629, h: 702 },
  card: { x: 614, y: 69, w: 448, h: 442 },
  ribbon: { y: 511, h: 86 },
  pill: { y: 599, h: 53 },
  panelTop: 686,
  footerH: 147
};
// Escala do cabeçalho e do rodapé por formato retrato (px absolutos).
const PORTRAIT = {
  stories: { k: 1, fk: 1, bottom: 38 },
  feed: { k: .78, fk: .82, bottom: 18 },
  square: { k: .6, fk: .7, bottom: 14 },
  print: { k: .573, fk: .6, bottom: 14 }
};

// Layout compartilhado pelo encarte (compose) e pelo fundo desenhado (design.mjs).
// variant: 'left' (selo à esquerda), 'right' (espelhado) ou 'top' (selo centralizado no topo, logo e validade abaixo).
export function layoutFor(f, W, H, variant = 'left') {
  // Distribuição no estilo do Sextou: selo grande à esquerda (≈62% da largura), coluna à direita com a logo
  // livre (estilo da logo vem do perfil do cliente), Instagram e faixa de validade; painel de produtos abaixo.
  let L;
  const tv = f === 'tv', u = tv ? 1 : W / 1080;
  if (!tv) {
    const { k, fk, bottom } = PORTRAIT[f];
    const margin = 17 * u;
    const right = W - margin;
    const footerH = REF.footerH * fk * u;
    const footer = { x: margin, y: H - bottom * u - footerH, w: W - margin * 2, h: footerH };
    const low = f === 'square' || f === 'print';
    const top = variant === 'top';
    const headerH = (low ? 458 * u : REF.panelTop * k) * (top ? 1.1 : 1);
    const rk = low ? .78 * u : k;
    let seal, card, ribbon, pill;
    if (top) {
      // Selo largo centralizado; abaixo, logo à esquerda e faixa de validade à direita.
      seal = { x: W * .05, y: 6 * u, w: W * .9, h: headerH * .56 };
      const rowY = seal.y + seal.h + 4 * u, colX = W * .5, colW = right - colX;
      pill = { x: colX, y: headerH - 14 * u - REF.pill.h * rk, w: colW, h: REF.pill.h * rk };
      ribbon = { x: colX, y: pill.y - 6 * u - REF.ribbon.h * rk, w: colW, h: REF.ribbon.h * rk };
      card = { x: margin, y: rowY, w: colX - margin - 10 * u, h: headerH - 6 * u - rowY };
    } else {
      seal = { x: 6 * u, y: 6 * u, w: W * .62, h: headerH - 4 * u };
      const colX = seal.x + seal.w + 6 * u, colW = right - colX;
      pill = { x: colX, y: headerH - 14 * u - REF.pill.h * rk, w: colW, h: REF.pill.h * rk };
      ribbon = { x: colX, y: pill.y - 6 * u - REF.ribbon.h * rk, w: colW, h: REF.ribbon.h * rk };
      card = { x: colX, y: 14 * u, w: colW, h: ribbon.y - 10 * u - 14 * u };
    }
    const panel = { x: margin, y: headerH, w: W - margin * 2 };
    panel.h = footer.y - 8 * u - panel.y;
      // Decoração 3D fica no fundo desenhado (design.mjs); sem elementos sobre o painel.
    const cubes = [];
    L = { k: rk, seal, cubes, card, ribbon, pill, panel, footer };
  } else {
    // TV: coluna lateral larga com selo grande, logo livre e validade; painel de produtos à direita.
    L = { k: .95,
      seal: { x: 14, y: 10, w: 552, h: 480 },
      cubes: [],
      card: { x: 20, y: 500, w: 540, h: 262 },
      ribbon: { x: 20, y: 772, w: 540, h: 82 },
      pill: { x: 20, y: 860, w: 540, h: 50 },
      panel: { x: 580, y: 20, w: 1320, h: 900 },
      footer: { x: 20, y: 934, w: 1880, h: 128 } };
  }
  // Espelhado: selo e coluna trocam de lado (na TV a coluna vai para a direita e o painel para a esquerda).
  if (variant === 'right') {
    const flip = b => ({ ...b, x: W - b.x - b.w });
    for (const key of ['seal', 'card', 'ribbon', 'pill']) L[key] = flip(L[key]);
    if (tv) L.panel = flip(L.panel);
  }

  return L;
}

export function compose({ donor, page, assets, ids, theme: T, slug, variant = 'left' }) {
  const RED = T.base, YELLOW = T.accent, DATE_YELLOW = T.date, INK = T.ink;
  const W = page.width, H = page.height, f = page.templateFormatId, tv = f === 'tv';
  const u = tv ? 1 : W / 1080;
  const frameId = ids.frame;
  const src = donor.objects;
  const take = name => { const o = src.find(x => x.name === name); assert(o, `Doador sem ${name}`); const c = structuredClone(o); delete c.clipPath; return c; };
  const base = { version: '7.1.0', parentFrameId: frameId, _frameClipOwner: frameId, originX: 'left', originY: 'top', scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true, selectable: true, evented: true, strokeWidth: 0, shadow: null };
  const obj = (type, name, p) => ({ ...base, type, name, _customId: randomUUID(), ...p });
  const rect = (name, b, fill, extra = {}) => obj('Rect', name, { left: b.x, top: b.y, width: b.w, height: b.h, fill, rx: 0, ry: 0, ...extra });
  const text = (name, value, b, size, fill, extra = {}) => obj('Textbox', name, { text: value, __rawText: value, left: b.x, top: b.y, width: b.w, fontSize: size, fontFamily: CONDENSED, fontWeight: 800, lineHeight: 1, fill, styles: {}, textAlign: 'left', splitByGrapheme: false, ...extra });
  const field = (name, key, value, b, size, fill, extra = {}) => text(name, value, b, size, fill, {
    fontFamily: SANS, businessProfileField: key, quickFieldEnabled: true, height: b.h, lineHeight: 1.05,
    dynamicFieldResizeMode: 'reflow', dynamicFieldKey: key, dynamicFieldHeight: b.h, dynamicFieldBaseFontSize: size,
    dynamicFieldAutoFitFontSize: size, dynamicFieldAutoHeight: false, __manualTransform: false, dynamicFieldTextColor: fill, __manualTypography: true, ...extra
  });
  const place = (o, x, y, size) => { const k = size / Math.max(o.width, o.height); return Object.assign(o, { left: x, top: y, originX: 'left', originY: 'top', scaleX: k, scaleY: k, parentFrameId: frameId, _frameClipOwner: frameId, _customId: randomUUID() }); };
  const vgrad = stops => ({ type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 0, y2: 1 }, colorStops: stops.map(([offset, color]) => ({ offset, color })) });

  const L = layoutFor(f, W, H, variant);

  const frame = structuredClone(src.find(o => o.isFrame));
  Object.assign(frame, { _customId: frameId, name: `template-frame-${slug}-${f}`, layerName: 'FRAMER', left: W / 2, top: H / 2, width: W, height: H, fill: RED, originX: 'center', originY: 'center' });
  const layers = [frame];
  const bg = assets.bg[f];
  layers.push(obj('Image', `Fundo ${T.name}`, { width: bg.meta.width, height: bg.meta.height, scaleX: W / bg.meta.width, scaleY: H / bg.meta.height, src: bg.url, __originalSrc: bg.url, crossOrigin: 'anonymous' }));

  // Selo 3D: ancorado no canto superior esquerdo, como na referência.
  const sa = assets.seal, sm = sa.meta, sk = Math.min(L.seal.w / sm.width, L.seal.h / sm.height);
  // Selos largos ficam centralizados na área do selo (sem sobra no topo).
  const sealLayer = obj('Image', `Selo 3D ${T.name}`, { width: sm.width, height: sm.height, src: sa.url, __originalSrc: sa.url, crossOrigin: 'anonymous', left: L.seal.x + (L.seal.w - sm.width * sk) / 2, top: L.seal.y + (L.seal.h - sm.height * sk) / 2, scaleX: sk, scaleY: sk });

  // Área de produtos: o fundo desenhado já traz a área clara com raios; o retângulo marca a região (sem moldura).
  const pk = tv ? 1 : u;
  layers.push(rect('product-area-background', L.panel, 'rgba(255,255,255,0)', { rx: 34 * pk, ry: 34 * pk }));

  layers.push(sealLayer);

  // Logo livre, sem cartão: fundo/contorno sticker seguem a preferência de logo do perfil do cliente.
  const c = L.card, ck = tv ? .9 : L.k, fk = ck;
  const ss = tv ? .66 : ck;
  const socialH = 60 * ss;
  const logoBox = { x: c.x, y: c.y, w: c.w, h: c.h - socialH - 6 * fk };
  const white = { x: c.x, y: c.y, w: c.w, h: c.h };
  const logo = take('header-logo-slot');
  const lk = Math.min(logoBox.w / logo.width, logoBox.h / logo.height);
  Object.assign(logo, { _customId: randomUUID(), parentFrameId: frameId, _frameClipOwner: frameId, originX: 'center', originY: 'center',
    left: logoBox.x + logoBox.w / 2, top: logoBox.y + logoBox.h / 2, scaleX: lk, scaleY: lk, angle: 0, shadow: null,
    quickLogoCenterX: logoBox.x + logoBox.w / 2, quickLogoCenterY: logoBox.y + logoBox.h / 2, quickLogoMaxWidth: logoBox.w, quickLogoMaxHeight: logoBox.h,
    quickLogoUseProfileInTemplate: true, quickLogoBackdropMode: 'none',
    // Padrão sobre fundo colorido: contorno sticker branco; a preferência de logo do cliente sobrescreve.
    __stickerOutlineEnabled: true, __stickerOutlineColor: '#FFFFFF', __stickerOutlineWidth: 4, __stickerOutlineMode: 'outside', __stickerOutlineOpacity: 1 });
  layers.push(logo);

  const socialW = Math.min(white.w - 20 * fk, 420 * ss);
  const so = { x: white.x + (white.w - socialW) / 2, y: white.y + white.h - socialH - 6 * fk, w: socialW, h: socialH };
  const icon = 40 * ss;
  layers.push(rect('header-social-background', so, 'rgba(0,0,0,0)', { footerLayout: 'campaign-social' }));
  const handle = { x: so.x + icon + 14 * ss, y: so.y + 14 * ss, w: so.w - icon - 14 * ss, h: 38 * ss };
  const handleStyle = { fontWeight: 800, dynamicTextCase: 'upper', __textCase: 'upper', shadow: { color: 'rgba(0,0,0,0.65)', blur: 6 * ss, offsetX: 0, offsetY: 2 * ss } };
  layers.push(field('header-instagram', 'instagram', '@SUPERMERCADORODRIGUES', handle, 25 * ss, '#ffffff', handleStyle));
  layers.push(place(take('header-icon-instagram'), so.x, so.y + (so.h - icon) / 2, icon));

  // Faixa vermelha de validade: calendário + título + período; pílula amarela com estoque.
  const r = L.ribbon, rk = r.h / REF.ribbon.h;
  layers.push(rect('validity-red-ribbon', r, vgrad([[0, T.card[1]], [.55, T.card[2]], [1, T.card[3]]]), { rx: 24 * rk, ry: 24 * rk, stroke: T.card[0], strokeWidth: 2.5 * rk, quickDynamicIconFor: 'validity',
    shadow: { color: T.shadow, blur: 10 * rk, offsetX: 0, offsetY: 4 * rk } }));
  const p = L.pill;
  layers.push(rect('reference-validity-stock-band', p, vgrad([[0, T.pill[0]], [.5, T.pill[1]], [1, T.pill[2]]]), { rx: p.h / 2, ry: p.h / 2, quickDynamicIconFor: 'validity',
    shadow: { color: T.shadow, blur: 6 * rk, offsetX: 0, offsetY: 2 * rk } }));
  const C = r.h * .58;
  const calX = r.x + 26 * rk;
  const band = { x: calX + C + 20 * rk, y: r.y + 4 * rk, w: r.x + r.w - 20 * rk - (calX + C + 20 * rk), h: r.h - 8 * rk };
  layers.push(rect('standard-validity-background', band, 'rgba(0,0,0,0)', { quickDynamicIconFor: 'validity' }));
  layers.push(text('validity-heading', ids.validity.heading, { x: band.x, y: band.y, w: band.w }, 30 * rk, '#ffffff', { fontFamily: SANS, fontWeight: 600, textAlign: 'center', quickDynamicIconFor: 'validity', dynamicFieldBaseFontSize: 30 * rk }));
  layers.push(text('header-validity', ids.validity.period, { x: band.x, y: band.y + 34 * rk, w: band.w }, 44 * rk, DATE_YELLOW, {
    fontFamily: SANS, fontWeight: 800, textAlign: 'center', quickDataField: 'validity', quickFieldEnabled: true, quickValidityLayout: 'offer-banner', quickValidityReferenceStyle: 'stack-pill', quickValidityCopyStyle: 'padded', quickValidityWhileStocks: true,
    dynamicFieldResizeMode: 'reflow', dynamicFieldKey: 'validity', dynamicFieldBaseFontSize: 44 * rk, dynamicFieldAutoFitFontSize: 44 * rk, dynamicFieldAutoHeight: true, dynamicFieldTextColor: DATE_YELLOW,
    shadow: { color: T.shadow, blur: 0, offsetX: 0, offsetY: 2 * rk } }));
  layers.push(text('stock-validity', ids.validity.stock, { x: p.x, y: p.y + 10 * rk, w: p.w }, 24 * rk, T.stockInk, { fontFamily: SANS, fontWeight: 700, textAlign: 'center', quickDynamicIconFor: 'validity', dynamicFieldBaseFontSize: 24 * rk }));
  const sw = C * .09;
  const calRect = (x, y, w, h, extra = {}) => ({ type: 'Rect', version: '7.1.0', left: x, top: y, width: w, height: h, originX: 'left', originY: 'top', fill: '#ffffff', strokeWidth: 0, rx: 0, ry: 0, ...extra });
  const cells = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) cells.push(calRect(-C * .29 + col * C * .22, C * .02 + row * C * .2, C * .14, C * .13, { rx: C * .02, ry: C * .02 }));
  layers.push(obj('Group', 'header-validity-calendar', { left: calX, top: r.y + (r.h - C) / 2 + 2 * rk, width: C, height: C, quickDynamicIconFor: 'validity', objects: [
    calRect(-C / 2 + sw / 2, -C / 2 + C * .12, C - sw, C * .86, { fill: '', stroke: '#ffffff', strokeWidth: sw, rx: C * .14, ry: C * .14 }),
    calRect(-C / 2 + sw / 2, -C / 2 + C * .12, C - sw, C * .2, { rx: C * .1, ry: C * .1 }),
    calRect(-C * .27, -C / 2, C * .11, C * .26, { rx: C * .05, ry: C * .05, stroke: T.card[2], strokeWidth: C * .03 }),
    calRect(C * .16, -C / 2, C * .11, C * .26, { rx: C * .05, ry: C * .05, stroke: T.card[2], strokeWidth: C * .03 }),
    ...cells] }));

  // Rodapé vermelho com borda amarela: WhatsApp | endereço | cartões em azulejos brancos (grade 3×2).
  const ft = L.footer, fs = ft.h / REF.footerH;
  layers.push(rect('footer-premium-background', ft, vgrad([[0, T.card[1]], [.6, T.card[2]], [1, T.card[3]]]), { rx: 24 * fs, ry: 24 * fs, stroke: T.gold[1], strokeWidth: 3 * fs,
    footerLayout: 'campaign-retail', footerColumnWeights: tv ? [1, 1.5, 1.7] : [1, 1.05, 1.05], shadow: { color: T.shadow, blur: 12 * fs, offsetX: 0, offsetY: 3 * fs } }));
  layers.push(field('footer-dynamic-whatsapp', 'whatsapp', '(11) 99999-9999', { x: ft.x + 90 * fs, y: ft.y + 50 * fs, w: 230 * fs, h: 44 * fs }, 30 * fs, '#ffffff', { fontWeight: 800 }));
  layers.push(field('footer-dynamic-address', 'address', 'Rua da Loja, 100 - Centro, Cidade - UF', { x: ft.x + 410 * fs, y: ft.y + 40 * fs, w: 260 * fs, h: 64 * fs }, 22 * fs, '#ffffff', { fontWeight: 700, lineHeight: 1.12 }));
  const wa = place(take('icon-whatsapp'), ft.x + 20 * fs, ft.y + 40 * fs, 60 * fs);
  if (wa.objects?.[0]) wa.objects[0].fill = '#25d366';
  wa.footerIconScale = .8;
  const pin = place(take('icon-address'), ft.x + 360 * fs, ft.y + 40 * fs, 56 * fs);
  Object.assign(pin, { fill: '#ffffff', stroke: '', footerIconScale: .62 });
  layers.push(wa, pin);
  const pay = take('footer-payment-images');
  Object.assign(pay, { _customId: randomUUID(), parentFrameId: frameId, _frameClipOwner: frameId, left: ft.x + ft.w * .66, top: ft.y + 12 * fs,
    footerPaymentWidth: ft.w * .32, footerPaymentHeight: ft.h - 24 * fs, footerPaymentTile: '#ffffff', ...(tv ? {} : { footerPaymentColumns: 3 }) });
  if (tv) delete pay.footerPaymentColumns;
  layers.push(pay);
  layers.push(rect('footer-column-divider-1', { x: ft.x + ft.w * .32, y: ft.y + 18 * fs, w: 2 * fs, h: ft.h - 36 * fs }, YELLOW));
  layers.push(rect('footer-column-divider-2', { x: ft.x + ft.w * .65, y: ft.y + 18 * fs, w: 2 * fs, h: ft.h - 36 * fs }, YELLOW));

  // Zona de produtos do doador, reposicionada dentro do painel.
  const cubeLayers = L.cubes.map((cb, i) => {
    const el = assets.elements[i % assets.elements.length], m = el.meta, ck2 = cb.size / Math.max(m.width, m.height);
    return obj('Image', `Elemento 3D desfocado ${i + 1}`, { width: m.width, height: m.height, src: el.url, __originalSrc: el.url, crossOrigin: 'anonymous', left: cb.x, top: cb.y, scaleX: ck2, scaleY: ck2, angle: i ? 14 : -12 });
  });
  const pad = 16 * pk;
  const zoneBox = { x: L.panel.x + pad, y: L.panel.y + pad, w: L.panel.w - pad * 2, h: L.panel.h - pad * 2 };
  const zone = structuredClone(src.find(o => o.isProductZone));
  assert.equal(zone._zoneStateSnapshot?.cards?.length || 0, 0);
  Object.assign(zone, { _customId: ids.zone, parentFrameId: frameId, _frameClipOwner: frameId, left: zoneBox.x + zoneBox.w / 2, top: zoneBox.y + zoneBox.h / 2,
    width: zoneBox.w, height: zoneBox.h, originX: 'center', originY: 'center', scaleX: 1, scaleY: 1, _zoneWidth: zoneBox.w, _zoneHeight: zoneBox.h,
    templateModelId: page.templateModelId, templateFormatId: f });
  Object.assign(zone.objects[0], { left: 0, top: 0, width: zoneBox.w, height: zoneBox.h, scaleX: 1, scaleY: 1, originX: 'center', originY: 'center' });
  Object.assign(zone._zoneStateSnapshot.zone, { id: ids.zone, parentFrameId: frameId });
  Object.assign(zone._zoneStateSnapshot.zone.geometry, { x: zone.left, y: zone.top, width: zone.width, height: zone.height, scaleX: 1, scaleY: 1, angle: 0 });
  const palette = { cardColor: '#ffffff', highlightCardColor: T.highlight, prodNameColor: T.nameInk, highlightProdNameColor: T.nameInk };
  Object.assign(zone._zoneGlobalStyles, { templateProductPalette: palette, cardColorMode: 'auto', cardColor: palette.cardColor, highlightCardColor: palette.highlightCardColor,
    highlightProdNameColor: palette.highlightProdNameColor, prodNameColor: palette.prodNameColor, cardBorderColor: T.cardBorder, cardBorderWidth: 2, accentColor: RED });
  delete zone._zoneGlobalStyles.productPalette;
  if (zone._zoneStateSnapshot.globalStyles) Object.assign(zone._zoneStateSnapshot.globalStyles, zone._zoneGlobalStyles);
  layers.push(zone);
  layers.push(...cubeLayers);

  for (const o of layers.slice(1)) { o.parentFrameId = frameId; o._frameClipOwner = frameId; }
  assert(zoneBox.h > 250, `zona pequena em ${f}`);
  return { version: donor.version, background: '', __labelTemplates: donor.__labelTemplates, templateModelId: page.templateModelId, templateModelName: page.templateModelName, templateFormatId: f, objects: layers };
}
