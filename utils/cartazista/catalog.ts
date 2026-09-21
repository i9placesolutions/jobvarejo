import type { CartazistaModel, CartazistaModelKey, CartazistaTemplateSummary } from '~/types/cartazista'

export const CARTAZISTA_STARTER_MODELS: CartazistaTemplateSummary[] = [
  { id: 'gondola', name: 'Etiqueta de Gôndola', category: 'Gôndola', description: 'Preço compacto para imprimir vários por folha.', tags: ['gôndola', 'etiqueta', 'preço'], example: 'PRODUTO 9,99', published: true, revision: 1 },
  { id: 'standard', name: 'Cartaz de Oferta Padrão', category: 'Preço', description: 'O cartaz direto: oferta, produto e preço grande.', tags: ['oferta', 'preço', 'padrão'], example: 'OFERTA PRODUTO 9,99', published: true, revision: 1 },
  { id: 'second-unit', name: 'Desconto a partir da segunda unidade', category: 'Desconto', description: 'Comunica a condição especial na compra de duas unidades.', tags: ['segunda unidade', 'desconto'], example: 'A PARTIR DA 2ª UNIDADE', published: true, revision: 1 },
  { id: 'de-por-discount', name: 'De/Por + % de Desconto', category: 'Desconto', description: 'Preço anterior, preço atual e percentual economizado.', tags: ['de por', 'percentual', 'desconto'], example: 'DE 12,99 POR 9,99', published: true, revision: 1 },
  { id: 'landscape', name: 'Cartaz de oferta — Deitado', category: 'Preço', description: 'Composição horizontal para aproveitar vitrines e corredores.', tags: ['paisagem', 'horizontal', 'oferta'], example: 'OFERTA HORIZONTAL', published: true, revision: 1 },
  { id: 'de-por', name: 'Cartaz — De/Por', category: 'Preço', description: 'Variação limpa para destacar preço antigo e novo.', tags: ['de por', 'preço'], example: 'DE 14,99 POR 11,99', published: true, revision: 1 },
  { id: 'wholesale-retail', name: 'Atacado/Varejo', category: 'Atacado', description: 'Mostra os dois preços sem confundir o consumidor.', tags: ['atacado', 'varejo', 'preço'], example: 'VAREJO 9,99 · ATACADO 8,99', published: true, revision: 1 },
  { id: 'club', name: 'Clube de Vantagens', category: 'Clube', description: 'Selo para ofertas exclusivas do clube da loja.', tags: ['clube', 'fidelidade'], example: 'PREÇO CLUBE 8,99', published: true, revision: 1 },
  { id: 'club-discount', name: 'Clube de vantagens + Desconto %', category: 'Clube', description: 'Une o benefício do clube ao percentual de desconto.', tags: ['clube', 'percentual', 'desconto'], example: 'CLUBE 20% OFF', published: true, revision: 1 },
  { id: 'pocket', name: 'Cartaz para Bolsão (Nome/Preço)', category: 'Gôndola', description: 'Modelo enxuto para bolsões, caixas e pontos de impulso.', tags: ['bolsão', 'nome', 'preço'], example: 'NOME DO PRODUTO 9,99', published: true, revision: 1 },
  { id: 'pack', name: 'Pack Oferta', category: 'Pack', description: 'Preço de um conjunto com quantidade e chamada claras.', tags: ['pack', 'conjunto', 'quantidade'], example: 'PACK 3 UN. 19,99', published: true, revision: 1 },
  { id: 'leve-3-2', name: 'Leve 3 por X / Leve 2 por Y', category: 'Leve e pague', description: 'Duas condições de quantidade na mesma peça.', tags: ['leve', 'quantidade', 'combo'], example: 'LEVE 3 POR 10 · LEVE 2 POR 8', published: true, revision: 1 },
  { id: 'leve-x-y', name: 'Leve X por Y / ou R$ X cada', category: 'Leve e pague', description: 'Comunica a mecânica leve e pague ou preço unitário.', tags: ['leve', 'por', 'unidade'], example: 'LEVE 4 POR 12', published: true, revision: 1 },
  { id: 'leve-por-legacy', name: 'Cartaz Leve/Por (Antigo)', category: 'Leve e pague', description: 'Variação tradicional para lojas que já usam essa linguagem.', tags: ['leve', 'por', 'tradicional'], example: 'LEVE 2 POR 10', published: true, revision: 1 }
]

export const getCartazistaModel = (id: string | undefined): CartazistaModel =>
  CARTAZISTA_STARTER_MODELS.find((model) => model.id === id) || CARTAZISTA_STARTER_MODELS[1]!

export const isCartazistaModelKey = (id: string): id is CartazistaModelKey =>
  CARTAZISTA_STARTER_MODELS.some((model) => model.id === id)
