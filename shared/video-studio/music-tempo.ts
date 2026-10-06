import generated from './generated-flyer-recipes.json'
import library from './music-library.json'

export interface MusicTempo { bpm: number; offset: number }
// Faixas embutidas com andamento conhecido; trilhas próprias de cada receita; biblioteca licenciada (BPM medido).
const TEMPO = new Map<string, MusicTempo>()
for (const r of generated as { music?: string; bpm?: number }[]) if (r.music && r.bpm && !TEMPO.has(r.music)) TEMPO.set(r.music, { bpm: r.bpm, offset: 0 })
TEMPO.set('retail-drive', { bpm: 140, offset: 0 })
TEMPO.set('retail-bounce', { bpm: 128, offset: 0 })
for (const t of library as { id: string; bpm: number; firstBeat?: number }[]) if (t.bpm > 0) TEMPO.set(t.id, { bpm: t.bpm, offset: t.firstBeat || 0 })

export const musicTempo = (id: string | undefined): MusicTempo | undefined => (id ? TEMPO.get(id) : undefined)

/** Quadros a pular no início da música para a primeira batida coincidir com o quadro 0. */
export const musicStartFrame = (id: string | undefined, beatSync: boolean | undefined, fps = 30) => (beatSync ? Math.round((musicTempo(id)?.offset || 0) * fps) : 0)

/**
 * Leva os cortes entre cenas para cima das batidas. Com locução só empurra para depois (nunca corta fala).
 * Mantém o total dentro do orçamento; se não couber, devolve as durações originais.
 */
export function snapScenesToBeats(frames: number[], bpm: number, budget: number, fps: number, extendOnly: boolean, maxFrames: number[] = []): number[] {
  const beat = (fps * 60) / bpm
  const out: number[] = []
  let acc = 0, prev = 0
  frames.forEach((f, i) => {
    acc += f
    let end = Math.round((extendOnly ? Math.ceil : Math.round)(acc / beat) * beat)
    // Teto da cena (ex.: oferta sem locução até 5 s): última batida que ainda cabe a partir do início da cena.
    if (!extendOnly && end - prev > (maxFrames[i] ?? Infinity)) end = Math.round(Math.floor((prev + maxFrames[i]!) / beat) * beat)
    if (end - prev < Math.round(beat)) end = prev + Math.round(beat)
    out.push(end - prev); prev = end
  })
  if (out.some((f, i) => f > (maxFrames[i] ?? Infinity))) return frames
  return out.reduce((a, b) => a + b, 0) <= budget ? out : frames
}
