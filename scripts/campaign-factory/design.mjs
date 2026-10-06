// Fundos desenhados estilo varejo, um estilo por campanha (cada modelo com identidade própria):
//  swoosh  — faixas curvas brilhantes + cantos em faixa      burst   — explosão pop-art + retícula + contorno HQ
//  diagonal— listras diagonais + painel com cantos cortados  wave    — ondas em camadas + painel de topo ondulado
//  chevron — setas >>> + linhas de velocidade                arch    — holofotes de palco + painel em arco
//  ribbon  — faixa/banner dobrada + faixas nos cantos        glam    — linhas douradas, bokeh e cantoneiras
// Tudo alinhado ao layout do encarte (layoutFor), com área de produtos clara para leitura.
import sharp from 'sharp';

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r1 = n => Math.round(n * 10) / 10;

function rays(cx, cy, r, n, color, opacity, rot = 0) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + rot, a1 = a0 + Math.PI / n;
    d += `M${r1(cx)},${r1(cy)} L${r1(cx + Math.cos(a0) * r)},${r1(cy + Math.sin(a0) * r)} L${r1(cx + Math.cos(a1) * r)},${r1(cy + Math.sin(a1) * r)} Z `;
  }
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}
// Faixa curva em S dentro da caixa b.
function band(b, y0, y1, t, fill, bend = .22) {
  const x0 = b.x - b.w * .08, x1 = b.x + b.w * 1.08, Y0 = b.y + b.h * y0, Y1 = b.y + b.h * y1, T = b.h * t;
  const c1 = [b.x + b.w * .35, Y0 - b.h * bend], c2 = [b.x + b.w * .62, Y1 + b.h * bend];
  return `<path d="M${x0},${Y0} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${x1},${Y1} L${x1},${Y1 + T} C${c2[0]},${c2[1] + T * 1.4} ${c1[0]},${c1[1] + T * 1.4} ${x0},${Y0 + T * 1.2} Z" fill="${fill}"/>`;
}
// Explosão de pontas com n pontas.
function spiky(cx, cy, rOut, rIn, n, fill, extra = '') {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, r = i % 2 ? rIn : rOut; d += `${i ? 'L' : 'M'}${r1(cx + Math.cos(a) * r)},${r1(cy + Math.sin(a) * r)} `; }
  return `<path d="${d}Z" fill="${fill}" ${extra}/>`;
}
const star4 = (x, y, s, fill, op = 1) => `<path d="M${x},${y - s} Q${x + s * .15},${y - s * .15} ${x + s},${y} Q${x + s * .15},${y + s * .15} ${x},${y + s} Q${x - s * .15},${y + s * .15} ${x - s},${y} Q${x - s * .15},${y - s * .15} ${x},${y - s} Z" fill="${fill}" opacity="${op}"/>`;

// Confete por estilo: triângulos, retângulos, bolinhas ou brilhos de 4 pontas.
function confetti(kind, area, n, colors, rand, unit) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = area.x + rand() * area.w, y = area.y + rand() * area.h, s = unit * (.6 + rand() * 1.4), a = rand() * 360, c = colors[i % colors.length], op = r1(.6 + rand() * .4);
    if (kind === 'tri') out.push(`<path d="M0,${r1(-s)} L${r1(s * .9)},${r1(s * .7)} L${r1(-s * .9)},${r1(s * .6)} Z" fill="${c}" opacity="${op}" transform="translate(${r1(x)},${r1(y)}) rotate(${r1(a)})"/>`);
    else if (kind === 'rect') out.push(`<rect x="${r1(-s * .35)}" y="${r1(-s)}" width="${r1(s * .7)}" height="${r1(s * 2)}" rx="${r1(s * .15)}" fill="${c}" opacity="${op}" transform="translate(${r1(x)},${r1(y)}) rotate(${r1(a)})"/>`);
    else if (kind === 'dot') out.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(s * .7)}" fill="${c}" opacity="${op}"/>`);
    else out.push(star4(r1(x), r1(y), r1(s * 1.2), c, op));
  }
  return out;
}

export function designSvg({ W, H, f, L, P, seed = 7, header, noPanel = false, style = 'swoosh' }) {
  const tv = f === 'tv', rand = rng(seed), u = tv ? 1 : W / 1080;
  const base = P.card[2], dark = P.card[4], deep = P.card[3], light = P.card[0], gold = P.gold;
  const tint = mix(base, '#ffffff', .88), tint2 = mix(base, '#ffffff', .72), ink = mix(dark, '#000000', .35);
  const p = L.panel, R = u * 30, s = L.seal;
  const sealC = [s.x + s.w / 2, s.y + s.h / 2];
  const left = sealC[0] < W / 2;
  const hb = header || (tv ? { x: Math.min(s.x, L.card.x) - 20, y: 0, w: 620, h: H } : { x: 0, y: 0, w: W, h: p.y });
  const confArea = tv ? { x: hb.x, y: 0, w: hb.w, h: H } : { x: 0, y: 0, w: W, h: Math.min(H, p.y * 1.02) };
  const cols = [gold[0], gold[1], '#ffffff', light];
  const headH = tv ? H : Math.min(H, p.y);
  const defs = `
 <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset=".35" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
 <radialGradient id="glow" cx="${sealC[0]}" cy="${sealC[1]}" r="${tv ? 520 : W * .7}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".25" stop-color="${light}" stop-opacity=".5"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>
 <radialGradient id="panel" cx="${p.x + p.w / 2}" cy="${p.y + p.h * .45}" r="${Math.max(p.w, p.h) * .62}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${tint}"/><stop offset="1" stop-color="${tint2}"/></radialGradient>
 <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(light, '#ffffff', .35)}"/><stop offset=".45" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient>
 <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gold[0]}"/><stop offset=".5" stop-color="${gold[1]}"/><stop offset="1" stop-color="${gold[2]}"/></linearGradient>
 <linearGradient id="darkG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
 <linearGradient id="baseG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient>
 <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <pattern id="dots" width="${18 * u}" height="${18 * u}" patternUnits="userSpaceOnUse"><circle cx="${9 * u}" cy="${9 * u}" r="${4 * u}" fill="${dark}" opacity=".35"/></pattern>
 <pattern id="dotsLight" width="${18 * u}" height="${18 * u}" patternUnits="userSpaceOnUse"><circle cx="${9 * u}" cy="${9 * u}" r="${3.4 * u}" fill="${base}" opacity=".12"/></pattern>
 <pattern id="diag" width="${44 * u}" height="${44 * u}" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="${16 * u}" height="${44 * u}" fill="#fff" opacity=".22"/></pattern>
 <pattern id="diamonds" width="${40 * u}" height="${40 * u}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${40 * u}" height="${40 * u}" fill="none" stroke="${gold[1]}" stroke-width="${1.2 * u}" opacity=".25"/></pattern>
 <clipPath id="pc"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${R}"/></clipPath>
 <filter id="soft"><feGaussianBlur stdDeviation="${3 * u}"/></filter>
 <filter id="blurBig"><feGaussianBlur stdDeviation="${14 * u}"/></filter>`;

  let back = `<rect width="100%" height="100%" fill="url(#bg)"/>`, deco = '', panelShape = '', panelInner = '', conf = [];
  const panelRect = (rx = R) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${rx}"`;
  switch (style) {
    case 'burst': {
      // Pop-art: explosão de pontas atrás do selo, retícula e contorno HQ com sombra deslocada.
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.3, 22, gold[1], .22);
      back += `<rect width="100%" height="100%" fill="url(#dots)"/>`;
      deco += spiky(sealC[0], sealC[1], Math.min(s.w, s.h) * .78, Math.min(s.w, s.h) * .56, 18, 'url(#goldG)', `stroke="${ink}" stroke-width="${8 * u}" stroke-linejoin="round"`);
      deco += spiky(sealC[0], sealC[1], Math.min(s.w, s.h) * .6, Math.min(s.w, s.h) * .45, 18, '#ffffff', 'opacity=".35"');
      panelShape = `<rect x="${p.x + 12 * u}" y="${p.y + 14 * u}" width="${p.w}" height="${p.h}" rx="${R}" fill="${ink}"/>${panelRect()} fill="url(#panel)" stroke="${ink}" stroke-width="${7 * u}"/>`;
      panelInner = rays(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h), 30, '#ffffff', .4) + `<rect x="${p.x}" y="${p.y + p.h * .72}" width="${p.w}" height="${p.h * .3}" fill="url(#dotsLight)"/>`;
      conf = confetti('dot', confArea, tv ? 50 : 40, cols, rand, 12 * u);
      break;
    }
    case 'diagonal': {
      // Listras diagonais de corrida no cabeçalho; painel com cantos cortados.
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.2, 26, '#ffffff', .05);
      back += `<rect x="0" y="0" width="${W}" height="${tv ? H : headH + 40 * u}" fill="url(#diag)"/>`;
      for (const [o, t, fill] of [[0, .16, 'url(#darkG)'], [.2, .05, 'url(#goldG)'], [.28, .09, 'url(#gloss)']]) {
        const y0 = hb.y + hb.h * (.55 + o), k = hb.w * .55;
        deco += `<path d="M${hb.x - 10},${y0} L${hb.x + hb.w + 10},${y0 - k} L${hb.x + hb.w + 10},${y0 - k + hb.h * t} L${hb.x - 10},${y0 + hb.h * t} Z" fill="${fill}"/>`;
      }
      const c = 70 * u, poly = `M${p.x + c},${p.y} L${p.x + p.w},${p.y} L${p.x + p.w},${p.y + p.h - c} L${p.x + p.w - c},${p.y + p.h} L${p.x},${p.y + p.h} L${p.x},${p.y + c} Z`;
      panelShape = `<path d="${poly}" fill="url(#panel)" stroke="${gold[1]}" stroke-width="${7 * u}" stroke-linejoin="round"/>`;
      panelInner = `<g opacity=".6"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="url(#diag)"/></g>` +
        `<path d="M${p.x + p.w * .7},${p.y + p.h} L${p.x + p.w},${p.y + p.h * .62} L${p.x + p.w},${p.y + p.h * .7} L${p.x + p.w * .76},${p.y + p.h} Z" fill="url(#goldG)"/><path d="M${p.x + p.w * .78},${p.y + p.h} L${p.x + p.w},${p.y + p.h * .72} L${p.x + p.w},${p.y + p.h} Z" fill="url(#darkG)"/>`;
      conf = confetti('rect', confArea, tv ? 50 : 38, cols, rand, 11 * u);
      break;
    }
    case 'wave': {
      // Ondas em camadas na base do cabeçalho; topo do painel ondulado.
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.2, 30, '#ffffff', .08);
      const wy = tv ? H * .82 : headH;
      const wave = (y, amp, fill, ph = 0) => `<path d="M0,${r1(y)} ${Array.from({ length: 8 }, (_, i) => `Q${r1(W * (i + .5) / 8)},${r1(y + (i % 2 ? amp : -amp) + ph)} ${r1(W * (i + 1) / 8)},${r1(y)}`).join(' ')} L${W},${H} L0,${H} Z" fill="${fill}"/>`;
      deco += wave(wy - 70 * u, 26 * u, 'url(#darkG)') + wave(wy - 46 * u, 22 * u, 'url(#goldG)', 6 * u) + wave(wy - 34 * u, 24 * u, 'url(#gloss)');
      if (!tv) deco += `<circle cx="${W * .86}" cy="${headH * .2}" r="${W * .16}" fill="${light}" opacity=".18"/><circle cx="${W * .95}" cy="${headH * .55}" r="${W * .08}" fill="#fff" opacity=".12"/>`;
      const top = p.y, waveTop = `M${p.x},${top + 24 * u} ${Array.from({ length: 6 }, (_, i) => `Q${r1(p.x + p.w * (i + .5) / 6)},${r1(top + (i % 2 ? 44 : 4) * u)} ${r1(p.x + p.w * (i + 1) / 6)},${r1(top + 24 * u)}`).join(' ')} L${p.x + p.w},${p.y + p.h - R} Q${p.x + p.w},${p.y + p.h} ${p.x + p.w - R},${p.y + p.h} L${p.x + R},${p.y + p.h} Q${p.x},${p.y + p.h} ${p.x},${p.y + p.h - R} Z`;
      panelShape = `<path d="${waveTop}" fill="url(#panel)" stroke="${gold[1]}" stroke-width="${5 * u}"/>`;
      panelInner = Array.from({ length: 7 }, (_, i) => `<circle cx="${p.x + p.w / 2}" cy="${p.y + p.h * .55}" r="${(i + 1) * Math.max(p.w, p.h) * .1}" fill="none" stroke="${base}" stroke-width="${10 * u}" opacity=".05"/>`).join('');
      conf = confetti('dot', confArea, tv ? 40 : 30, cols, rand, 10 * u).concat(confetti('star', confArea, 10, ['#ffffff', gold[0]], rand, 10 * u));
      break;
    }
    case 'chevron': {
      // Setas >>> grandes atrás do cabeçalho e linhas de velocidade.
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.2, 24, '#ffffff', .06);
      const ch = (x, y, sz, fill, op = 1) => `<path d="M${r1(x)},${r1(y - sz)} L${r1(x + sz * .7)},${r1(y - sz)} L${r1(x + sz * 1.6)},${r1(y)} L${r1(x + sz * .7)},${r1(y + sz)} L${r1(x)},${r1(y + sz)} L${r1(x + sz * .9)},${r1(y)} Z" fill="${fill}" opacity="${op}"/>`;
      const cy = tv ? H * .5 : headH * .55, sz = tv ? 220 : headH * .32;
      for (let i = 0; i < 4; i++) {
        const x = left ? W * .45 + i * sz * .95 : W * .55 - i * sz * .95 - sz * 1.6;
        deco += `<g ${left ? '' : `transform="translate(${r1(2 * x + sz * 1.6)},0) scale(-1,1)"`}>${ch(x, cy, sz, i % 2 ? 'url(#goldG)' : 'url(#gloss)', r1(.35 + i * .12))}</g>`;
      }
      for (let i = 0; i < 14; i++) { const y = rand() * headH, l = (80 + rand() * 260) * u; deco += `<rect x="${r1(rand() * W)}" y="${r1(y)}" width="${r1(l)}" height="${3 * u}" rx="${1.5 * u}" fill="#fff" opacity=".35"/>`; }
      panelShape = `${panelRect(R * .6)} fill="url(#panel)" stroke="${gold[1]}" stroke-width="${6 * u}"/>`;
      panelInner = Array.from({ length: 5 }, (_, i) => ch(p.x + p.w * (.08 + i * .2), p.y + p.h * .93, 40 * u, base, .07)).join('') + rays(p.x + p.w / 2, p.y + p.h * .45, Math.max(p.w, p.h), 36, '#ffffff', .3);
      conf = confetti('tri', confArea, tv ? 50 : 36, cols, rand, 13 * u);
      break;
    }
    case 'arch': {
      // Palco: holofotes vindos do topo e painel em arco.
      back += `<ellipse cx="${p.x + p.w / 2}" cy="${p.y + 40 * u}" rx="${p.w * .7}" ry="${120 * u}" fill="${light}" opacity=".35" filter="url(#blurBig)"/>`;
      for (let i = 0; i < 5; i++) { const x = W * (.1 + i * .2), sp = (tv ? 300 : W * .22), bottom = tv ? H : headH + 60 * u; deco += `<path d="M${r1(x - 14 * u)},0 L${r1(x + 14 * u)},0 L${r1(x + sp * (i - 2) * .4 + sp * .5)},${r1(bottom)} L${r1(x + sp * (i - 2) * .4 - sp * .5)},${r1(bottom)} Z" fill="url(#beam)" opacity=".55"/>`; }
      deco += rays(sealC[0], sealC[1], Math.max(W, H), 30, '#ffffff', .06);
      const archH = Math.min(140 * u, p.h * .18);
      const path = `M${p.x},${p.y + archH} Q${p.x + p.w / 2},${p.y - archH} ${p.x + p.w},${p.y + archH} L${p.x + p.w},${p.y + p.h - R} Q${p.x + p.w},${p.y + p.h} ${p.x + p.w - R},${p.y + p.h} L${p.x + R},${p.y + p.h} Q${p.x},${p.y + p.h} ${p.x},${p.y + p.h - R} Z`;
      panelShape = `<path d="${path}" fill="url(#panel)" stroke="url(#goldG)" stroke-width="${9 * u}"/>`;
      panelInner = rays(p.x + p.w / 2, p.y + p.h, Math.max(p.w, p.h) * 1.2, 34, '#ffffff', .4);
      conf = confetti('star', confArea, tv ? 34 : 26, ['#ffffff', gold[0], light], rand, 12 * u);
      break;
    }
    case 'ribbon': {
      // Faixa/banner dobrada atravessando o cabeçalho e faixas diagonais nos cantos superiores do painel.
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.2, 28, '#ffffff', .07);
      const by = s.y + s.h * (tv ? .62 : .66), bh = tv ? 120 : s.h * .2;
      deco += `<path d="M${-20},${by + bh * .3} L${W * .06},${by + bh * .3} L${W * .06},${by + bh * 1.3} L${-20},${by + bh * 1.3} L${W * .025},${by + bh * .8} Z" fill="url(#darkG)"/>`;
      deco += `<path d="M${W + 20},${by + bh * .3} L${W * .94},${by + bh * .3} L${W * .94},${by + bh * 1.3} L${W + 20},${by + bh * 1.3} L${W * .975},${by + bh * .8} Z" fill="url(#darkG)"/>`;
      deco += `<rect x="${W * .04}" y="${by}" width="${W * .92}" height="${bh}" fill="url(#gloss)"/><rect x="${W * .04}" y="${by + bh * .12}" width="${W * .92}" height="${bh * .08}" fill="url(#goldG)"/><rect x="${W * .04}" y="${by + bh * .8}" width="${W * .92}" height="${bh * .08}" fill="url(#goldG)"/>`;
      panelShape = `${panelRect()} fill="url(#panel)" stroke="${gold[1]}" stroke-width="${6 * u}"/>`;
      const sash = (x0, flip) => { const k = flip ? -1 : 1, a = 150 * u; return `<path d="M${x0},${p.y + a} L${x0 + k * a},${p.y} L${x0 + k * (a + 46 * u)},${p.y} L${x0},${p.y + a + 46 * u} Z" fill="url(#goldG)"/><path d="M${x0},${p.y + a * .55} L${x0 + k * a * .55},${p.y} L${x0 + k * (a * .55 + 30 * u)},${p.y} L${x0},${p.y + a * .55 + 30 * u} Z" fill="url(#darkG)"/>`; };
      panelInner = rays(p.x + p.w / 2, p.y + p.h * .5, Math.max(p.w, p.h), 32, '#ffffff', .35) + sash(p.x, false) + sash(p.x + p.w, true);
      conf = confetti('rect', confArea, tv ? 44 : 34, cols, rand, 11 * u);
      break;
    }
    case 'glam': {
      // Luxo: linhas douradas finas, arcos, bokeh desfocado e cantoneiras douradas no painel.
      back += `<g filter="url(#blurBig)">${Array.from({ length: 16 }, () => `<circle cx="${r1(rand() * W)}" cy="${r1(rand() * headH * 1.1)}" r="${r1((20 + rand() * 60) * u)}" fill="${gold[rand() > .5 ? 0 : 1]}" opacity="${r1(.15 + rand() * .3)}"/>`).join('')}</g>`;
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.2, 40, gold[0], .07);
      for (let i = 0; i < 6; i++) deco += `<path d="M-50,${r1(headH * (.15 + i * .16))} Q${W * .5},${r1(headH * (.15 + i * .16) - 160 * u)} ${W + 50},${r1(headH * (.05 + i * .16))}" fill="none" stroke="url(#goldG)" stroke-width="${(i % 2 ? 2 : 4) * u}" opacity=".7"/>`;
      const cn = 90 * u, k = 10 * u, corner = (x, y, sx, sy) => `<path d="M${x},${y + sy * cn} L${x},${y} L${x + sx * cn},${y}" fill="none" stroke="url(#goldG)" stroke-width="${k}" stroke-linecap="round"/>`;
      panelShape = `${panelRect(R * .5)} fill="url(#panel)"/><rect x="${p.x + 10 * u}" y="${p.y + 10 * u}" width="${p.w - 20 * u}" height="${p.h - 20 * u}" rx="${R * .4}" fill="none" stroke="${gold[1]}" stroke-width="${2.5 * u}"/>${panelRect(R * .5)} fill="none" stroke="url(#goldG)" stroke-width="${6 * u}"/>` +
        corner(p.x + 18 * u, p.y + 18 * u, 1, 1) + corner(p.x + p.w - 18 * u, p.y + 18 * u, -1, 1) + corner(p.x + 18 * u, p.y + p.h - 18 * u, 1, -1) + corner(p.x + p.w - 18 * u, p.y + p.h - 18 * u, -1, -1);
      panelInner = `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="url(#diamonds)"/>`;
      conf = confetti('star', confArea, tv ? 36 : 28, [gold[0], '#ffffff', gold[1]], rand, 11 * u);
      break;
    }
    default: {
      // swoosh — faixas curvas brilhantes e faixas diagonais nos cantos inferiores.
      back += rays(sealC[0], sealC[1], Math.max(W, H) * 1.2, 28, '#ffffff', .07);
      const sb = { x: hb.x + hb.w * .45, y: hb.y - hb.h * .25, w: hb.w * .6, h: hb.h * .6 };
      deco += band(hb, .88, .02, .26, 'url(#darkG)', .25) + band(hb, .93, .09, .18, 'url(#gloss)', .25) + band(hb, 1.05, .22, .04, 'url(#goldG)', .25) + band(hb, 1.11, .28, .09, 'url(#baseG)', .25) + band(sb, .55, -.05, .12, 'url(#gloss)', .18) + band(sb, .66, .05, .035, 'url(#goldG)', .18);
      panelShape = `${panelRect()} fill="url(#panel)" stroke="${gold[1]}" stroke-width="${5 * u}"/>`;
      const corner = side => { const flip = side === 'right', X = v => flip ? p.x + p.w - v : p.x + v, bottom = p.y + p.h, w = p.w * .30, h = p.h * .42;
        const shp = (k, fill) => `<path d="M${X(-p.w * .02)},${bottom - h * k} C${X(w * .25 * k)},${bottom - h * k * .55} ${X(w * .55 * k)},${bottom - h * k * .18} ${X(w * k)},${bottom + 4} L${X(-p.w * .02)},${bottom + 4} Z" fill="${fill}"/>`;
        return shp(1, 'url(#gloss)') + shp(.82, 'url(#goldG)') + shp(.74, 'url(#darkG)') + shp(.5, 'url(#baseG)'); };
      panelInner = rays(p.x + p.w / 2, p.y + p.h * .45, Math.max(p.w, p.h), 40, '#ffffff', .35) + corner('left') + corner('right');
      conf = confetti('tri', confArea, tv ? 60 : 46, cols, rand, 16 * u);
    }
  }
  const third = Math.floor(conf.length / 3);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>
${back}
<rect width="100%" height="100%" fill="url(#glow)"/>
<g>${deco}</g>
<g filter="url(#soft)" opacity=".9">${conf.slice(0, third).join('')}</g>${conf.slice(third).join('')}
${noPanel ? '' : `${panelShape}<g clip-path="url(#pc)">${panelInner}</g>`}
</svg>`;
}

// Elemento 3D preparado (recorte, cor, rotação, tamanho).
async function element(file, size, rot, hue = 0) {
  let img = sharp(file).trim({ threshold: 1 });
  if (hue) img = img.modulate({ hue });
  const buf = await img.resize({ width: Math.round(size), height: Math.round(size), fit: 'inside' }).png().toBuffer();
  const pad = Math.round(size * .2);
  return sharp(buf).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}
async function place(comps, W, H, input, cx, cy) {
  const m = await sharp(input).metadata(), left = Math.round(cx - m.width / 2), top = Math.round(cy - m.height / 2);
  const cl = Math.max(0, -left), ct = Math.max(0, -top), cw = Math.min(m.width - cl, W - Math.max(0, left)), ch = Math.min(m.height - ct, H - Math.max(0, top));
  if (cw > 0 && ch > 0) comps.push({ input: await sharp(input).extract({ left: cl, top: ct, width: cw, height: ch }).png().toBuffer(), left: Math.max(0, left), top: Math.max(0, top) });
}

// Fundo completo: SVG do estilo + destaque atrás do selo (estrela, exceto pop-art/palco) + elementos 3D em volta.
// As posições espelham conforme o lado do selo; cada estilo tem um arranjo próprio.
const ARRANGE = {
  swoosh: [[1, .06, .9, 150, -18], [0, .92, .12, 150, 16], [3, .86, .93, 110, 10]],
  burst: [[0, .02, .1, 170, -20], [2, .98, .85, 150, 18], [1, .1, .95, 120, 8]],
  diagonal: [[0, .95, .05, 140, 22], [1, .03, .92, 130, -12], [2, .55, .02, 100, 30]],
  wave: [[1, .02, .2, 130, -10], [0, .96, .7, 140, 14], [3, .5, .97, 100, -6]],
  chevron: [[0, .02, .92, 160, -24], [3, .98, .05, 120, 20], [1, .6, .98, 110, 4]],
  arch: [[1, -.02, .6, 140, -16], [3, 1.02, .6, 140, 16], [0, .5, -.04, 110, 8]],
  ribbon: [[0, .04, .05, 140, -18], [2, .96, .1, 140, 18], [1, .5, .99, 120, 0]],
  glam: [[1, .03, .88, 140, -14], [3, .95, .1, 120, 18], [1, .9, .9, 100, 8]]
};
export async function designBackground({ W, H, f, L, P, star, items, seed, header, noPanel, style = 'swoosh', format = 'jpeg' }) {
  const comps = [], tv = f === 'tv', u = tv ? 1 : W / 1080;
  const s = L.seal, cx = s.x + s.w / 2, cy = s.y + s.h / 2, out = cx < W / 2 ? 1 : -1;
  const ox = v => out > 0 ? s.x + s.w * v : s.x + s.w * (1 - v);
  if (star && !['burst', 'arch'].includes(style)) await place(comps, W, H, await element(star.file, Math.min(s.w, s.h) * (style === 'glam' ? 1.25 : 1.1), -12 * out, star.hue), cx - out * s.w * .06, cy);
  for (const [i, x, y, size, rot] of ARRANGE[style] || []) { const it = items[i] || items[0]; await place(comps, W, H, await element(it.file, size * u, rot * out, it.hue), ox(x), s.y + s.h * y); }
  if (!noPanel && !tv) { const it = items[2] || items[0]; await place(comps, W, H, await element(it.file, 120 * u, -12 * out, it.hue), out > 0 ? W * .97 : W * .03, L.panel.y + L.panel.h * .5); }
  const svg = Buffer.from(designSvg({ W, H, f, L, P, seed, header, noPanel, style }));
  const img = sharp(svg).composite(comps);
  return format === 'png' ? img.png().toBuffer() : img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// Raios cinza sobre preto (sem alfa) para girar no vídeo com mistura "screen".
export function raysPng(size) {
  const c = size / 2;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#000"/>${rays(c, c, size * .75, 32, '#242424', 1)}</svg>`)).png().toBuffer();
}
