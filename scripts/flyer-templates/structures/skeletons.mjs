/**
 * Estruturas de encarte (onde ficam selo, logo, validade, contatos e produtos), nos 5 formatos.
 * O tema (fundo, cores, selo) é independente: qualquer tema da fábrica roda em qualquer estrutura.
 * Regras aprovadas (memória encarte-forma-e-logo): cabeçalho em cima/rodapé embaixo usa selo e logo
 * LADO A LADO, grandes; a Faixa Lateral mantém a coluna vertical. TV usa a coluna padrão da fábrica.
 * Medidas em unidades de 1080 px de largura; `u` converte (A4 = 794 px).
 */
import { layoutFor } from '../../campaign-factory/compose.mjs'

const RIBBON = 86, PILL = 53, FOOTER = 147

const validityAt = (x, w, bottom, rk) => {
  const pill = { x, y: bottom - PILL * rk, w, h: PILL * rk }
  const ribbon = { x, y: pill.y - 6 * rk - RIBBON * rk, w, h: RIBBON * rk }
  return { ribbon, pill }
}

// Rodapé horizontal de largura total (mesma escala da fábrica por formato).
const FOOTER_SCALE = { feed: [.76, 16], stories: [.9, 38], square: [.66, 12], print: [.6, 14] }
const fullFooter = (f, W, H) => {
  const u = W / 1080, [fk, bottom] = FOOTER_SCALE[f], h = FOOTER * fk * u
  return { x: 17 * u, y: H - bottom * u - h, w: W - 34 * u, h }
}

// Cabeçalho padrão: selo ~50% à esquerda; logo grande à direita, Instagram e validade abaixo dela.
const PAIR = { feed: [456, .74], stories: [640, .9], square: [380, .66], print: [456, .74] }
const pairHeader = (f, W) => {
  const u = W / 1080, [hh, k] = PAIR[f], headerH = hh * u, rk = k * u
  const seal = { x: 8 * u, y: 8 * u, w: W * .5, h: headerH - 14 * u }
  const colX = seal.x + seal.w + 14 * u, colW = W - 17 * u - colX
  const { ribbon, pill } = validityAt(colX, colW, headerH - 12 * u, rk)
  const card = { x: colX, y: 12 * u, w: colW, h: ribbon.y - 10 * u - 12 * u }
  return { headerH, rk, seal, card, ribbon, pill }
}
const topBottom = (f, W, H) => {
  if (f === 'tv') return layoutFor('tv', W, H, 'left')
  const h = pairHeader(f, W), footer = fullFooter(f, W, H), u = W / 1080
  const panel = { x: 17 * u, y: h.headerH, w: W - 34 * u, h: footer.y - 8 * u - h.headerH }
  return { k: h.rk, seal: h.seal, card: h.card, ribbon: h.ribbon, pill: h.pill, panel, footer, cubes: [] }
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

export const STRUCTURES = {
  // Dois produtos herói grandes no topo da área de produtos e grade menor abaixo.
  heroi: {
    name: 'Produto Herói',
    layout: topBottom,
    recipes: f => Object.fromEntries(range(3, 16).map(count => {
      const normal = count - 2, wide = f === 'tv' ? 5 : 4
      const columns = normal <= 3 ? normal : normal <= 6 ? 3 : normal <= 8 ? 4 : wide
      return [count, { columns, showcase: { highlightCount: 2, highlightHeight: f === 'square' ? 1.5 : f === 'stories' ? 1.7 : 1.9 } }]
    })),
    sample: { feed: 8, stories: 8, square: 5, print: 8, tv: 8 }
  },
  // Painel de setores: dividido na geração conforme os departamentos do pedido.
  setores: {
    name: 'Setores',
    layout: topBottom,
    sectorPanel: true
  },
  // Coluna lateral com selo, logo, validade e contatos empilhados; produtos na altura toda.
  lateral: {
    name: 'Faixa Lateral',
    layout: (f, W, H) => {
      if (f === 'tv') return layoutFor('tv', W, H, 'left')
      const u = W / 1080, rk = .76 * u, colW = 372 * u
      const [sealH, cardH] = { feed: [396, 244], stories: [560, 300], square: [300, 196], print: [430, 250] }[f]
      const seal = { x: 6 * u, y: 8 * u, w: colW - 12 * u, h: sealH * u }
      const card = { x: 17 * u, y: seal.y + seal.h + 6 * u, w: colW - 28 * u, h: cardH * u }
      const vTop = card.y + card.h + 8 * u
      const ribbon = { x: 17 * u, y: vTop, w: colW - 28 * u, h: RIBBON * rk }
      const pill = { x: 17 * u, y: vTop + RIBBON * rk + 6 * rk, w: colW - 28 * u, h: PILL * rk }
      const footer = { x: 17 * u, y: pill.y + pill.h + 14 * u, w: colW - 28 * u, h: 0 }
      footer.h = H - 17 * u - footer.y
      const panel = { x: colW + 14 * u, y: 17 * u, w: W - colW - 14 * u - 17 * u, h: H - 34 * u }
      return { k: rk, seal, card, ribbon, pill, panel, footer, cubes: [] }
    },
    footerStack: f => f !== 'tv',
    columnBackground: f => f !== 'tv',
    recipes: f => f === 'tv' ? null : Object.fromEntries(range(1, 16).map(count => [count, { columns: count <= 3 ? 1 : 2 }])),
    sample: { feed: 8, stories: 10, square: 6, print: 8, tv: 8 }
  }
}

export const FORMATS = [
  { id: 'feed', width: 1080, height: 1350 }, { id: 'square', width: 1080, height: 1080 },
  { id: 'stories', width: 1080, height: 1920 }, { id: 'print', width: 794, height: 1123 }, { id: 'tv', width: 1920, height: 1080 }
]
