import type { VideoDocument, VideoScript } from './model'

const spokenToken = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// Quebras de linha são formatação. As ofertas continuam na ordem do vídeo,
// com os nomes como âncoras; os trechos sem âncora são distribuídos entre elas.
export function mapNarrationScripts(doc: VideoDocument, text: string): VideoScript[] | null {
  const ids = ['intro', ...doc.offers.map(offer => offer.id), 'outro']
  const lines = text.replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean)
  if (lines.length === ids.length) return ids.map((id, index) => ({ id, text: lines[index]! }))
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length < ids.length) return null
  const tokens = words.map(spokenToken)
  const starts = new Map<number, number>([[0, 0], [ids.length, words.length]])
  let lastScene = 0, lastWord = 0
  for (const [index, offer] of doc.offers.entries()) {
    const name = offer.name.split(/\s+/).map(spokenToken).filter(Boolean).slice(0, 3)
    if (!name.length) continue
    const scene = index + 1
    const found = tokens.findIndex((_, position) => position >= lastWord + scene - lastScene
      && position <= words.length - (ids.length - scene)
      && name.every((token, offset) => tokens[position + offset] === token))
    if (found >= 0) { starts.set(scene, found); lastScene = scene; lastWord = found }
  }
  const outro = tokens.findIndex((token, index) => index >= lastWord + ids.length - 1 - lastScene && /^(aproveite|venha|corra)$/.test(token))
  if (outro >= 0) starts.set(ids.length - 1, outro)
  const anchors = [...starts.entries()].sort(([a], [b]) => a - b)
  for (let index = 1; index < anchors.length; index++) {
    const [firstScene, firstWord] = anchors[index - 1]!, [lastScene, lastWord] = anchors[index]!
    for (let scene = firstScene + 1; scene < lastScene; scene++) {
      const lower = starts.get(scene - 1)! + 1, upper = lastWord - (lastScene - scene)
      const target = Math.round(firstWord + (lastWord - firstWord) * (scene - firstScene) / (lastScene - firstScene))
      let boundary = Math.max(lower, Math.min(upper, target))
      // Prefere terminar uma frase, sem consumir palavras de outra âncora.
      for (let delta = 0; delta <= 3; delta++) {
        const sentence = [boundary - delta, boundary + delta].find(position => position >= lower && position <= upper && /[.!?]$/.test(words[position - 1]!))
        if (sentence !== undefined) { boundary = sentence; break }
      }
      starts.set(scene, boundary)
    }
  }
  return ids.map((id, index) => ({ id, text: words.slice(starts.get(index), starts.get(index + 1)).join(' ') }))
}
