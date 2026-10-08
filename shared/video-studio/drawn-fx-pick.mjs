// Sorteio determinístico dos efeitos desenhados — JavaScript puro, usado pela composição (drawn-fx.ts)
// e pelo worker (seleção dos arquivos a baixar), para os dois escolherem exatamente os mesmos clipes.
const hash = (n) => { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296 }
const SALT = { price: 1, product: 2, transition: 3, ambient: 4 }

/**
 * Clipe da categoria para a posição `slot` (oferta ou corte), variando entre ofertas e entre vídeos (semente).
 * @param {string|undefined} category @param {number} seed @param {number} slot
 * @param {'price'|'product'|'transition'|'ambient'} moment @param {Array<{id:number,category:string,coverage:number}>} clips
 */
export function pickDrawnFxClip(category, seed, slot, moment, clips) {
  if (!category || category === 'none') return null
  let pool = clips.filter(c => c.category === category)
  // Transição precisa cobrir a tela; preço e produto preferem efeitos compactos.
  const prefer = moment === 'transition' ? c => category === 'transicao' || c.coverage >= .18 : moment === 'price' || moment === 'product' ? c => c.coverage < .6 : null
  if (prefer && pool.some(prefer)) pool = pool.filter(prefer)
  if (!pool.length) return null
  const order = pool.map(c => ({ c, k: hash(c.id * 31 + seed * 7 + SALT[moment]) })).sort((a, b) => a.k - b.k || a.c.id - b.c.id)
  return order[slot % order.length].c
}

/** Arquivos usados por um documento (para o worker baixar só o necessário). */
export function drawnFxFiles(document, clips, sceneCount) {
  const fx = document?.motion?.drawnFx
  if (!fx) return []
  const seed = Number(document.variationSeed || 0), files = new Set(), slots = Math.max(1, sceneCount + 2)
  for (const moment of ['price', 'product', 'transition']) for (let i = 0; i < slots; i++) {
    const clip = pickDrawnFxClip(fx[moment], seed, i, moment, clips)
    if (clip) files.add(clip.file)
  }
  const ambient = pickDrawnFxClip(fx.ambient, seed, 0, 'ambient', clips)
  if (ambient) files.add(ambient.file)
  return [...files]
}
