// 10 campanhas montadas com itens do acervo Magnific (download de stock, sem IA).
// Cada uma: selo 3D (PSD → PNG), foto de fundo, elemento 3D decorativo, vídeo de fundo e música da biblioteca.
const GOLD = ['#ffe34a', '#ffb000', '#ff8a00'];
const PILL = ['#fff27a', '#ffd91a', '#f5b800'];
const base = { gold: GOLD, pill: PILL, date: '#ffe300', highlight: '#fff3b0' };

export const PALETTES = {
  red: { ...base, base: '#d90201', accent: '#ffd200', ink: '#2a1414', card: ['#ff5a44', '#f01d10', '#d40808', '#a00000', '#7a0000'], stockInk: '#8a0000', shadow: 'rgba(90,0,0,0.5)', nameInk: '#3a0a0a', cardBorder: '#ffd9a8' },
  blue: { ...base, base: '#0b44b8', accent: '#ffd200', ink: '#0b1f4d', card: ['#4f8bff', '#1f5fe0', '#0b44b8', '#062c80', '#041d57'], stockInk: '#0a2d78', shadow: 'rgba(0,15,60,0.5)', nameInk: '#0b1f4d', cardBorder: '#bcd3ff' },
  blackGold: { ...base, base: '#111111', accent: '#e8b923', ink: '#1a1a1a', date: '#ffd75a', card: ['#5a5a5a', '#2c2c2c', '#161616', '#000000', '#000000'], gold: ['#fff1a8', '#e8b923', '#b8860b'], pill: ['#fff1a8', '#f2c94c', '#c99a1a'], stockInk: '#2a1d00', shadow: 'rgba(0,0,0,0.6)', highlight: '#fff4cc', nameInk: '#1a1a1a', cardBorder: '#e6cf8a' },
  orange: { ...base, base: '#ff7a00', accent: '#ffd200', ink: '#2a1a0a', card: ['#ffb067', '#ff7a00', '#e35d00', '#a33a00', '#6e2600'], stockInk: '#7a2e00', shadow: 'rgba(90,30,0,0.5)', nameInk: '#3a1a00', cardBorder: '#ffd2a1' },
  wood: { ...base, base: '#5b2c14', accent: '#ffc21a', ink: '#2a1406', card: ['#e0452f', '#b81d0e', '#8f1208', '#5e0a04', '#3b0602'], stockInk: '#5e0a04', shadow: 'rgba(30,10,0,0.6)', highlight: '#ffe9c2', nameInk: '#3a1406', cardBorder: '#e3c29a' },
  green: { ...base, base: '#13801f', accent: '#ffd200', ink: '#0d2e10', card: ['#5fd35a', '#22a52a', '#13801f', '#0a5a14', '#063d0d'], stockInk: '#0a4d12', shadow: 'rgba(0,40,0,0.5)', nameInk: '#0d2e10', cardBorder: '#bfe8b5' },
  yellowRed: { ...base, base: '#f5b800', accent: '#e30613', ink: '#2a1414', card: ['#ff5a44', '#f01d10', '#d40808', '#a00000', '#7a0000'], stockInk: '#8a0000', shadow: 'rgba(90,40,0,0.45)', nameInk: '#3a0a0a', cardBorder: '#ffd9a8' },
  purple: { ...base, base: '#5b21b6', accent: '#ffd200', ink: '#2a0e4d', card: ['#b07bff', '#7c3aed', '#5b21b6', '#3b0f80', '#260a55'], stockInk: '#3b0f80', shadow: 'rgba(30,0,60,0.5)', nameInk: '#2a0e4d', cardBorder: '#d9c4ff' },
  blackRed: { ...base, base: '#1a1a1a', accent: '#e01408', ink: '#1a1a1a', card: ['#ff4a3d', '#e01408', '#b00000', '#6e0000', '#2a0000'], gold: ['#f2f2f2', '#bdbdbd', '#8a8a8a'], stockInk: '#6e0000', shadow: 'rgba(0,0,0,0.6)', highlight: '#ffe0dc', nameInk: '#1a1a1a', cardBorder: '#f0b4ae' }
};

// seal/bg/element/video = ids do Magnific; music = id da biblioteca do estúdio de vídeo.
export const CAMPAIGNS = [
  { slug: 'mega-oferta-estrelas', name: 'Mega Oferta — Preto e Dourado', seal: 373928820, bg: 61037064, elements: [28211246], video: 4150821, palette: 'blackGold', music: 'lib-magnific-5141', motion: 'camera' },
  { slug: 'aqui-tem-super-ofertas', name: 'Aqui Tem Super Ofertas — Laranja', seal: 47967040, bg: 47928372, elements: [412450421], video: 9866945, palette: 'orange', music: 'lib-magnific-2759', motion: 'bounce' },
  { slug: 'fim-de-semana-imbativel', name: 'Fim de Semana Imbatível — Azul e Vermelho', seal: 409787719, bg: 75936425, elements: [65756585], video: 9660453, palette: 'blue', music: 'lib-magnific-3082', motion: 'impact' },
  { slug: 'quinta-da-carne-brasa', name: 'Quinta da Carne — Madeira e Brasa', seal: 49462352, bg: 39085615, elements: [211554171], video: 2841861, palette: 'wood', music: 'lib-magnific-2702', motion: 'embers' },
  { slug: 'clube-de-descontos', name: 'Clube de Descontos — Verde', seal: 171916144, bg: 378134013, elements: [57396571], video: 91280, palette: 'green', music: 'lib-magnific-2650', motion: 'bounce' },
  { slug: 'super-economia', name: 'Super Economia — Amarelo e Vermelho', seal: 40562978, bg: 382257210, elements: [65756585], video: 5063757, palette: 'yellowRed', music: 'lib-magnific-2700', motion: 'impact' },
  { slug: 'promocao-do-dia', name: 'Promoção do Dia — Roxo', seal: 420576792, bg: 378133397, elements: [211554171], video: 91331, palette: 'purple', music: 'lib-magnific-4218', motion: 'camera' },
  { slug: 'super-promocao-preto', name: 'Super Promoção — Preto e Vermelho', seal: 418002001, bg: 156205307, elements: [391160330], video: 5063757, palette: 'blackRed', music: 'lib-magnific-5557', motion: 'impact' },
  { slug: 'mega-promocao', name: 'Mega Promoção — Vermelho e Dourado', seal: 116170687, bg: 201664294, elements: [28211246], video: 7789349, palette: 'red', music: 'lib-magnific-3209', motion: 'impact' },
  { slug: 'promocao-da-semana', name: 'Promoção da Semana — Laranja e Vermelho', seal: 40855901, bg: 15739920, elements: [133912841], video: 9866945, palette: 'orange', music: 'lib-magnific-2365', motion: 'bounce' }
];

// Decoração 3D do fundo (cubos "%" recoloridos por hue, moedas, sacola...) e cor da explosão de luz.
const red = ['378782681-1', '378782681-2', '378782681-3'], black = ['378782975-1', '378782975-2', '378782975-3'];
const cubes = (ids, hue = 0) => ids.map(id => ({ id, hue }));
const G = { coins: { id: '28211246' }, star: { id: '19427445' }, ribbon: { id: '88368223' }, bolt: { id: '28827235' }, mega: { id: '36161768' }, gift: { id: '58378153' }, bag: { id: '133912841' }, cart: { id: '57396571' }, redCoins: { id: '65756585' }, orangeCoins: { id: '412450421' } };
// Ordem importa: [0] e [2] são os destaques (cubos), [1] e [3] os complementos.
export const DECOR = {
  'mega-oferta-estrelas': { glow: '#ffcf4a', items: [{ id: black[0] }, G.coins, { id: black[1] }, G.star] },
  'aqui-tem-super-ofertas': { glow: '#ffd23a', items: [{ id: red[0], hue: 25 }, G.orangeCoins, { id: red[1], hue: 25 }, G.mega] },
  'fim-de-semana-imbativel': { glow: '#9fd0ff', items: [{ id: red[0] }, G.coins, { id: red[2] }, G.bolt] },
  'quinta-da-carne-brasa': { glow: '#ffb347', items: [{ id: red[0] }, G.coins, { id: red[1] }, G.star] },
  'clube-de-descontos': { glow: '#e8ff7a', items: [{ id: red[0], hue: 120 }, G.cart, { id: red[2], hue: 120 }, G.coins] },
  'super-economia': { glow: '#fff3a0', items: [{ id: red[0] }, G.redCoins, { id: red[1] }, G.coins] },
  'promocao-do-dia': { glow: '#ffd6ff', items: [{ id: red[0], hue: 270 }, G.bolt, { id: red[2], hue: 270 }, G.star] },
  'super-promocao-preto': { glow: '#ff6a4a', items: [{ id: black[0] }, G.gift, { id: red[1] }, { id: black[2] }] },
  'mega-promocao': { glow: '#ffd23a', items: [{ id: red[0] }, G.coins, { id: red[2] }, G.gift] },
  'promocao-da-semana': { glow: '#ffd23a', items: [{ id: red[0] }, G.bag, { id: red[1] }, G.mega] }
};

// Identidade própria por campanha: estilo do fundo (design.mjs) e posição do cabeçalho (layoutFor).
export const LOOK = {
  'mega-oferta-estrelas': { style: 'glam', layout: 'left' },
  'aqui-tem-super-ofertas': { style: 'chevron', layout: 'right' },
  'fim-de-semana-imbativel': { style: 'swoosh', layout: 'left' },
  'quinta-da-carne-brasa': { style: 'diagonal', layout: 'right' },
  'clube-de-descontos': { style: 'wave', layout: 'left' },
  'super-economia': { style: 'burst', layout: 'left' },
  'promocao-do-dia': { style: 'arch', layout: 'top' },
  'super-promocao-preto': { style: 'burst', layout: 'right' },
  'mega-promocao': { style: 'ribbon', layout: 'right' },
  'promocao-da-semana': { style: 'wave', layout: 'top' }
};

// Layout do vídeo por variante (base: Sextou). 'right' espelha; 'top' centraliza o selo no vertical.
const SEXTOU_V = { seal: [24, 56, 520, 560], logo: [560, 64, 496, 300], validity: [560, 384, 496, 210], product: [60, 652, 960, 678], name: [85, 1348, 910, 85], price: [85, 1445, 910, 340], condition: [85, 1795, 910, 34] };
const SEXTOU_H = { seal: [60, 24, 560, 560], logo: [40, 596, 600, 250], validity: [40, 856, 600, 182], product: [675, 160, 1240, 630], name: [785, 638, 1050, 90], condition: [785, 1040, 1050, 30], price: [785, 740, 1050, 295] };
const mirror = (L, W) => Object.fromEntries(Object.entries(L).map(([k, [x, y, w, h]]) => [k, [W - x - w, y, w, h]]));
export function videoLayout(layout) {
  if (layout === 'right') return { vertical: mirror(SEXTOU_V, 1080), horizontal: mirror(SEXTOU_H, 1920) };
  if (layout === 'top') return { vertical: { ...SEXTOU_V, seal: [120, 56, 840, 400], logo: [140, 464, 800, 220], validity: [220, 692, 640, 140], product: [60, 840, 960, 490] }, horizontal: SEXTOU_H };
  return { vertical: SEXTOU_V, horizontal: SEXTOU_H };
}
// Transição e conjunto de movimentos próprios por campanha (vídeos diferentes entre si).
export const VIDEO_FX = {
  'mega-oferta-estrelas': { transition: 'star-burst', motion: 'camera' },
  'aqui-tem-super-ofertas': { transition: 'chevron-wipe', motion: 'bounce' },
  'fim-de-semana-imbativel': { transition: 'radial-burst', motion: 'impact' },
  'quinta-da-carne-brasa': { transition: 'flash-wipe', motion: 'embers' },
  'clube-de-descontos': { transition: 'confetti-pop', motion: 'bounce' },
  'super-economia': { transition: 'diamond-wipe', motion: 'impact' },
  'promocao-do-dia': { transition: 'zoom-through', motion: 'camera' },
  'super-promocao-preto': { transition: 'glitch-slice', motion: 'impact' },
  'mega-promocao': { transition: 'curtain', motion: 'bounce' },
  'promocao-da-semana': { transition: 'stripe-wipe', motion: 'camera' }
};

export const theme = c => ({ ...PALETTES[c.palette], name: c.name.split(' — ')[0] });
