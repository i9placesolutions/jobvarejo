import {motionSettings,PRODUCT_ENTRANCES,TEXT_ENTRANCES,SCENE_TRANSITIONS,PRODUCT_FINISHES,PRICE_ACCENTS,type ProductEntrance,type TextEntrance,type SceneTransition,type SoundEffect,type PriceAccent,type VideoMotionSettings} from './effect-catalog'
import type {VideoDocument} from './model'
import sfxLibrary from './sfx-library.json'

export interface SceneStyle {
  transition: SceneTransition; product: ProductEntrance; price: ProductEntrance; text: TextEntrance
  finish: NonNullable<VideoMotionSettings['finish']>; priceAccent: PriceAccent; transitionSound: SoundEffect; accentSound: SoundEffect
}

const hash = (value: string) => { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return h >>> 0 }
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items]; let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) { s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0; const j = s % (i + 1); [out[i], out[j]] = [out[j]!, out[i]!] }
  return out
}
// Fila sem repetir o item anterior: a primeira oferta mantém a escolha do modelo.
function pick<T>(pool: readonly T[], base: T, index: number, seed: number): T {
  if (index <= 0) return base
  const order = shuffled(pool.filter(item => item !== base), seed)
  return order.length ? order[(index - 1) % order.length]! : base
}

// Transições curtas que combinam com varejo; 'fade' fica só para quem escolher modo fixo.
const TRANSITION_POOL = SCENE_TRANSITIONS.map(t => t.id).filter(id => id !== 'fade') as SceneTransition[]
const FINISH_POOL = PRODUCT_FINISHES.map(f => f.id).filter(id => id !== 'chromatic')
const ACCENT_POOL = PRICE_ACCENTS.map(a => a.id).filter(id => id !== 'none') as PriceAccent[]
// Sons da biblioteca licenciada entram no sorteio pela categoria (passagem x destaque de preço).
const LIB = sfxLibrary as { id: string; category?: string }[]
const SWOOSH_POOL = ['air-swipe', 'whip', 'suction', 'retail-whoosh-v1', 'glitch', ...LIB.filter(s => /whoosh|swipe|transi/.test(s.category || '')).map(s => s.id)] as SoundEffect[]
const ACCENT_SOUND_POOL = ['pop', 'coin', 'sparkle', 'snap', 'metal-hit', ...LIB.filter(s => /pop|coin|cash|sparkle|chime/.test(s.category || '')).map(s => s.id)] as SoundEffect[]

/** Estilo de uma cena de oferta (offerIndex 0 = primeira oferta). Modo fixo devolve o estilo único do vídeo. */
export function sceneStyle(doc: VideoDocument, offerIndex: number): SceneStyle {
  const m = motionSettings(doc.motion)
  const base: SceneStyle = {
    transition: doc.transition, product: m.product, price: m.price, text: m.text, finish: m.finish || 'clean',
    priceAccent: (doc.priceAccent || 'none') as PriceAccent, transitionSound: m.transitionSound, accentSound: m.accentSound
  }
  if (doc.motionVariation !== 'varied' || offerIndex <= 0) return base
  const seed = (doc.variationSeed ?? hash(String(doc.theme))) >>> 0
  return {
    transition: pick(TRANSITION_POOL, base.transition, offerIndex, seed ^ 0x1a2b),
    product: pick(PRODUCT_ENTRANCES.map(p => p.id), base.product, offerIndex, seed ^ 0x2b3c),
    price: pick(PRODUCT_ENTRANCES.map(p => p.id), base.price, offerIndex, seed ^ 0x3c4d),
    text: pick(TEXT_ENTRANCES.map(t => t.id), base.text, offerIndex, seed ^ 0x4d5e),
    finish: pick(FINISH_POOL, base.finish, offerIndex, seed ^ 0x5e6f) as SceneStyle['finish'],
    priceAccent: pick(ACCENT_POOL, base.priceAccent === 'none' ? 'shine' : base.priceAccent, offerIndex, seed ^ 0x6f70),
    transitionSound: pick(SWOOSH_POOL, base.transitionSound, offerIndex, seed ^ 0x7081),
    accentSound: pick(ACCENT_SOUND_POOL, base.accentSound, offerIndex, seed ^ 0x8192)
  }
}

/** Índice da oferta para uma cena da linha do tempo (intro e encerramento não são ofertas). */
export const offerIndexOf = (doc: VideoDocument, sceneId: string) => doc.offers.findIndex(o => o.id === sceneId)
