import { createCartazistaDocument, rebuildCartazistaComposition } from './composition'
import { CARTAZISTA_CAMPAIGN_MODELS } from './headers'
import type { CartazistaHeader, CartazistaModelKey, CartazistaThemeId } from '~/types/cartazista'

export function cartazistaSample(modelId: CartazistaModelKey, headers: CartazistaHeader[] = [], options: { themeId?: CartazistaThemeId; header?: CartazistaHeader | null } = {}) {
  const doc=createCartazistaDocument({modelId,themeId:options.themeId})
  Object.assign(doc.products[0]!,{name:'PRODUTO\nMARCA',unit:'DESCRIÇÃO DO PRODUTO',price:99.99,oldPrice:129.99,secondPrice:14.99,wholesalePrice:89.99,packQuantity:12,packPrice:49.90})
  if(modelId==='second-unit')doc.products[0]!.price=19.99
  if(modelId==='leve-pague')Object.assign(doc.products[0]!,{packQuantity:4,payQuantity:3})
  if(modelId==='pack')Object.assign(doc.products[0]!,{name:'CERVEJA\nMARCA',unit:'LATA 350ML',price:4.99})
  if(modelId==='de-por-discount')Object.assign(doc.products[0]!,{price:19.99,oldPrice:39.99})
  if(modelId==='leve-3-2'||modelId==='leve-x-y')Object.assign(doc.products[0]!,{price:4.99,packQuantity:3,packPrice:12,secondPrice:5.99})
  if(CARTAZISTA_CAMPAIGN_MODELS.includes(modelId))doc.settings.header=headers.find(h=>/hort/i.test(h.name))||headers[0]
  if(options.header !== undefined) doc.settings.header=options.header ?? undefined
  return rebuildCartazistaComposition(doc).composition
}
