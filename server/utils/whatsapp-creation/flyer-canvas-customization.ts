import type { ProductCardConfiguration, ProductCardElementKey, ProductCardConfigurationProfileKey } from '~/types/product-zone'
import type { CreationProduct, FlyerCustomization } from '~/shared/whatsapp-creation'

/**
 * Aplica a personalização do cliente ao canvas JSON do modelo (antes do render) e à receita de
 * card. Funções puras sobre JSON: nada aqui grava no banco nem altera a configuração salva da conta.
 */

type CanvasNode = Record<string, any>
type Box = { left: number; top: number; width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round = (value: number) => Math.round(value * 100) / 100
const kind = (node: CanvasNode) => String(node?.type || '').toLowerCase()

/** Todos os objetos (inclusive filhos de grupos) em ordem de pintura. */
export function flattenCanvasObjects(canvas: CanvasNode): CanvasNode[] {
  const output: CanvasNode[] = []
  const visit = (nodes: unknown) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node || typeof node !== 'object') continue
      output.push(node as CanvasNode)
      visit((node as CanvasNode).objects)
    }
  }
  visit(canvas?.objects)
  return output
}

/** Caixa renderizada do objeto no plano do canvas, respeitando a origem. */
export function objectBox(object: CanvasNode): Box {
  const width = Math.abs(Number(object.width) || 0) * Math.abs(Number(object.scaleX) || 1)
  const height = Math.abs(Number(object.height) || 0) * Math.abs(Number(object.scaleY) || 1)
  const left = Number(object.left) || 0, top = Number(object.top) || 0
  const originX = String(object.originX || 'left'), originY = String(object.originY || 'top')
  return {
    left: originX === 'center' ? left - width / 2 : originX === 'right' ? left - width : left,
    top: originY === 'center' ? top - height / 2 : originY === 'bottom' ? top - height : top,
    width, height
  }
}

/** Escala o objeto em torno do próprio centro; a posição visual do centro não muda. */
export function scaleAboutCenter(object: CanvasNode, factor: number): void {
  const before = objectBox(object)
  const cx = before.left + before.width / 2, cy = before.top + before.height / 2
  object.scaleX = (Number(object.scaleX) || 1) * factor
  object.scaleY = (Number(object.scaleY) || 1) * factor
  const after = objectBox(object)
  const originX = String(object.originX || 'left'), originY = String(object.originY || 'top')
  object.left = originX === 'center' ? cx : originX === 'right' ? cx + after.width / 2 : cx - after.width / 2
  object.top = originY === 'center' ? cy : originY === 'bottom' ? cy + after.height / 2 : cy - after.height / 2
}

/** Área onde o objeto pode crescer: o frame que o contém ou, sem frame, a página inteira. */
function growthBounds(canvas: CanvasNode, object: CanvasNode, all: CanvasNode[]): Box {
  const frame = object.parentFrameId ? all.find(item => item.isFrame === true && item._customId === object.parentFrameId) : undefined
  return frame ? objectBox(frame) : { left: 0, top: 0, width: Number(canvas.width) || 1080, height: Number(canvas.height) || 1920 }
}

/** Fator efetivo: aumentar nunca passa do limite do frame/página; diminuir não tem teto. */
function limitedFactor(canvas: CanvasNode, object: CanvasNode, all: CanvasNode[], factor: number): number {
  if (factor <= 1) return factor
  const box = objectBox(object), bounds = growthBounds(canvas, object, all)
  if (box.width <= 0 || box.height <= 0) return 1
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2
  const room = Math.min(
    2 * Math.min(cx - bounds.left, bounds.left + bounds.width - cx) / box.width,
    2 * Math.min(cy - bounds.top, bounds.top + bounds.height - cy) / box.height
  )
  return Math.max(1, Math.min(factor, room))
}

export const isLogoSlotImage = (object: CanvasNode): boolean => kind(object) === 'image' && object.quickLogoSlot === true

/**
 * Escala a logo da conta e o fundo (backdrop) que a acompanha, mantendo o centro e sem sair do
 * frame. Retorna o fator realmente aplicado (1 = não coube crescer) ou 0 quando não há logo.
 */
export function scaleFlyerLogo(canvas: CanvasNode, factor: number): number {
  const all = flattenCanvasObjects(canvas)
  const logos = all.filter(isLogoSlotImage)
  if (!logos.length || !(factor > 0)) return 0
  let applied = factor
  for (const logo of logos) {
    const effective = limitedFactor(canvas, logo, all, factor)
    applied = Math.min(applied, effective)
    if (Math.abs(effective - 1) < 1e-6) continue
    scaleAboutCenter(logo, effective)
    if (Number(logo.quickLogoMaxWidth) > 0) logo.quickLogoMaxWidth = Number(logo.quickLogoMaxWidth) * effective
    if (Number(logo.quickLogoMaxHeight) > 0) logo.quickLogoMaxHeight = Number(logo.quickLogoMaxHeight) * effective
    const center = objectBox(logo)
    logo.quickLogoCenterX = center.left + center.width / 2
    logo.quickLogoCenterY = center.top + center.height / 2
    for (const backdrop of all) {
      if (backdrop.quickLogoBackdrop !== true) continue
      const owned = (backdrop.quickLogoBackdropOwnerId && backdrop.quickLogoBackdropOwnerId === logo._customId) ||
        (logo.quickLogoBackdropId && logo.quickLogoBackdropId === backdrop._customId)
      if (owned) scaleAboutCenter(backdrop, effective)
    }
  }
  return applied
}

/** Selo decorativo do modelo: imagem com nome de selo/badge que não é logo, card nem selo +18. */
export function isDecorativeSealImage(object: CanvasNode): boolean {
  if (kind(object) !== 'image' || isLogoSlotImage(object)) return false
  const name = String(object.name || '')
  if (!/selo|seal|badge/i.test(name) || /alcool|alcohol|\b18\b|\+18|bebida|maior(?:es)? de idade/i.test(name)) return false
  return !object.parentZoneId && !object.productZoneId && !object.isProductCard
}

/** Escala os selos decorativos do cabeçalho. `found` = quantos existem; `applied` = fator efetivo. */
export function scaleFlyerSeal(canvas: CanvasNode, factor: number): { found: number; applied: number } {
  const all = flattenCanvasObjects(canvas)
  const seals = all.filter(isDecorativeSealImage)
  let applied = factor
  for (const seal of seals) {
    const effective = limitedFactor(canvas, seal, all, factor)
    applied = Math.min(applied, effective)
    if (Math.abs(effective - 1) >= 1e-6) scaleAboutCenter(seal, effective)
  }
  return { found: seals.length, applied: seals.length ? applied : 0 }
}

const isZone = (object: CanvasNode) => object?.isProductZone === true || object?.isGridZone === true

/**
 * Estilos da zona de produtos: tamanho do nome, cores e etiqueta. Espelha o que o editor rápido
 * grava (zona + _zoneStateSnapshot.globalStyles). Chamar depois de carregar as etiquetas no canvas
 * (`__labelTemplates`) e com os IDs de etiqueta já conferidos.
 */
export function applyFlyerZoneCustomization(canvas: CanvasNode, customization: FlyerCustomization): number {
  const zones = flattenCanvasObjects(canvas).filter(isZone)
  const templates: Array<{ id: unknown; group?: unknown }> = Array.isArray(canvas.__labelTemplates) ? canvas.__labelTemplates : []
  for (const zone of zones) {
    const styles: CanvasNode = { ...(zone._zoneGlobalStyles && typeof zone._zoneGlobalStyles === 'object' ? zone._zoneGlobalStyles : {}) }
    if (customization.nameScale) styles.prodNameScale = round(clamp((Number(styles.prodNameScale) || 1) * customization.nameScale, 0.5, 2.5))
    const palette = customization.palette
    if (palette) {
      const productPalette: CanvasNode = { ...(styles.productPalette || {}) }
      if (palette.highlightCardColor) {
        productPalette.highlightCardColor = palette.highlightCardColor
        styles.highlightCardColor = palette.highlightCardColor
        if (palette.highlightProdNameColor) productPalette.highlightProdNameColor = palette.highlightProdNameColor
        if (!palette.cardColor) { styles.cardColorMode = 'auto'; styles.isProdBgTransparent = false }
      }
      if (palette.cardColor) {
        // Cor única para todos: no modo manual os destacados também usam a cor, então o nome contrasta nos dois.
        styles.cardColorMode = 'manual'
        styles.cardColor = palette.cardColor
        styles.isProdBgTransparent = false
        if (palette.prodNameColor) { productPalette.prodNameColor = palette.prodNameColor; productPalette.highlightProdNameColor = palette.prodNameColor }
      }
      styles.productPalette = productPalette
    }
    if (customization.labelTemplateId) {
      const id = customization.labelTemplateId
      styles.splashTemplateId = id
      zone._zoneTemplateSnapshotId = id
      const group = templates.find(template => String(template?.id) === id)?.group
      if (group && typeof group === 'object') {
        zone._zoneTemplateSnapshot = JSON.parse(JSON.stringify(group))
        if (zone._zoneStateSnapshot && typeof zone._zoneStateSnapshot === 'object') {
          zone._zoneStateSnapshot.labelTemplate = { ...(zone._zoneStateSnapshot.labelTemplate || {}), id, snapshot: zone._zoneTemplateSnapshot }
        }
      }
    }
    zone._zoneGlobalStyles = styles
    if (zone._zoneStateSnapshot && typeof zone._zoneStateSnapshot === 'object') {
      zone._zoneStateSnapshot.globalStyles = { ...(zone._zoneStateSnapshot.globalStyles || {}), ...styles }
    }
  }
  return zones.length
}

/** IDs de etiqueta que existem em `__labelTemplates`; desconhecidos saem (e viram aviso). */
export function sanitizeFlyerLabelIds(canvas: CanvasNode, customization: FlyerCustomization): { customization: FlyerCustomization; dropped: string[] } {
  const known = new Set((Array.isArray(canvas.__labelTemplates) ? canvas.__labelTemplates : []).map((template: CanvasNode) => String(template?.id)))
  const dropped: string[] = []
  const next: FlyerCustomization = { ...customization }
  if (next.labelTemplateId && !known.has(next.labelTemplateId)) { dropped.push(next.labelTemplateId); delete next.labelTemplateId }
  if (next.itemLabelTemplateIds) {
    const kept = Object.entries(next.itemLabelTemplateIds).filter(([, id]) => known.has(id) || (dropped.push(id), false))
    if (kept.length) next.itemLabelTemplateIds = Object.fromEntries(kept)
    else delete next.itemLabelTemplateIds
  }
  return { customization: next, dropped }
}

/** IDs de etiqueta pedidos (para carregá-las do banco junto com as do modelo). */
export function customizationLabelIds(customization: FlyerCustomization | undefined): string[] {
  return [...new Set([customization?.labelTemplateId, ...Object.values(customization?.itemLabelTemplateIds || {})].filter((id): id is string => Boolean(id)))]
}

const CARD_ELEMENT_SCALE: Array<[keyof FlyerCustomization, ProductCardElementKey]> = [['labelScale', 'price'], ['badgeScale', 'alcoholBadge']]

/**
 * Cópia da receita do card com a etiqueta (caixa `price`) e o selo +18 maiores/menores em torno
 * do centro, limitados ao card. A receita original (tabela product_cards) nunca é alterada.
 */
export function scaleCardLayout<T extends ProductCardConfiguration>(layout: T, customization: FlyerCustomization | undefined): T {
  if (!customization || !CARD_ELEMENT_SCALE.some(([key]) => customization[key])) return layout
  const next = JSON.parse(JSON.stringify(layout)) as T
  const scaleElements = (elements: Record<string, any> | undefined) => {
    if (!elements) return
    for (const [key, element] of CARD_ELEMENT_SCALE) {
      const factor = Number(customization[key])
      const box = elements[element]
      if (!(factor > 0) || !box) continue
      const room = (center: number) => 2 * Math.max(0, Math.min(center, 100 - center))
      // Se o modelo já ocupa o limite do card, não cresce; nunca fica menor do que a receita pedida.
      box.width = round(clamp(box.width * factor, Math.min(1, box.width), Math.max(box.width, Math.min(100, room(box.x)))))
      box.height = round(clamp(box.height * factor, Math.min(1, box.height), Math.max(box.height, Math.min(100, room(box.y)))))
    }
  }
  scaleElements(next.elements as Record<string, any>)
  for (const profile of Object.keys(next.profiles || {}) as ProductCardConfigurationProfileKey[]) scaleElements(next.profiles?.[profile]?.elements as Record<string, any>)
  return next
}

/**
 * Campos de personalização que seguem em cada produto para o worker: etiqueta própria e
 * quantidade/direção de fotos. Itens sem personalização ficam como estavam.
 */
export function customizeFlyerItem<T extends Pick<CreationProduct, 'id'>>(item: T, customization: FlyerCustomization | undefined): T & { labelTemplateId?: string; imageFillCount?: number; imageFillDirection?: 'auto' | 'horizontal' | 'vertical' } {
  if (!customization) return item
  const fill = { ...(customization.imageFill || {}), ...(customization.itemImageFill?.[item.id] || {}) }
  const labelTemplateId = customization.itemLabelTemplateIds?.[item.id] || customization.labelTemplateId
  return {
    ...item,
    ...(labelTemplateId && customization.itemLabelTemplateIds?.[item.id] ? { labelTemplateId } : {}),
    ...(fill.count ? { imageFillCount: fill.count } : {}),
    ...(fill.direction ? { imageFillDirection: fill.direction } : {})
  }
}
