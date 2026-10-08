// Coleta ampla de efeitos desenhados (estilo RTFX) no acervo de vídeo do Magnific. Só busca (sem download).
import fs from 'node:fs/promises'
import { api } from './api.mjs'
const CATS = {
  explosao: ['cartoon explosion', 'anime explosion', '2d explosion fx', 'explosão desenho animado', 'comic explosion', 'hand drawn explosion'],
  fogo: ['cartoon fire', 'anime fire fx', '2d fire animation', 'fogo desenho animado', 'hand drawn fire', 'cartoon flame'],
  fumaca: ['cartoon smoke', 'anime smoke fx', '2d smoke puff', 'fumaça desenho animado', 'hand drawn smoke', 'cartoon dust puff'],
  energia: ['anime energy fx', 'cartoon energy blast', '2d energy burst', 'magic burst cartoon', 'anime aura'],
  eletricidade: ['cartoon lightning', 'anime lightning fx', '2d electricity', 'cartoon electric', 'raio desenho animado'],
  faiscas: ['cartoon sparks', 'anime sparkle fx', '2d sparks animation', 'cartoon twinkle', 'cartoon stars burst'],
  liquido: ['cartoon water splash', 'anime liquid fx', '2d splash animation', 'cartoon liquid', 'paint splash cartoon'],
  linhas: ['anime speed lines', 'manga speed lines', 'comic action lines', 'cartoon motion lines', 'linhas de velocidade'],
  comic: ['comic burst', 'comic pow', 'onomatopoeia animation', 'cartoon impact', 'anime impact frame', 'speech bubble animation', 'comic boom'],
  transicao: ['cartoon transition', 'fire transition', 'smoke transition cartoon', 'liquid transition', 'ink transition', 'matte transition', 'shape transition 2d'],
}
const ASPECTS = ['16:9', '9:16', '1:1']
const KEEP = /2d|cartoon|desenh|anime|mangá|manga|quadrinh|comic|hand.?drawn|à mão|animad|onomatop|balão|vfx elemento|transição|matte|tinta|splash|respingo/i
const DROP = /3d loop|esfera|spinner|carregamento|equaliz|visualiz|realist|slow motion|câmera lenta|people|pessoa|mulher|homem|logo reveal|template|modelo de|texto 3d|countdown|contagem/i
const all = new Map()
for (const [cat, terms] of Object.entries(CATS)) for (const term of terms) for (const aspect of ASPECTS) for (const page of [1, 2]) {
  try {
    const r = await api('/v1/videos', { term, limit: 50, page, [`filters[aspect-ratio][${aspect}]`]: 1 })
    for (const d of r.data || []) {
      const title = d.name || d.title || ''
      if (!KEEP.test(title) || DROP.test(title)) continue
      const prev = all.get(d.id)
      if (prev) { prev.cats.add(cat); continue }
      all.set(d.id, { id: d.id, title, aspect, duration: d.duration, thumb: d.thumbnails?.[0]?.url || d.thumbnail?.url || d.preview?.url || d.image?.source?.url, cats: new Set([cat]) })
    }
  } catch (e) { console.log('erro', term, aspect, page, String(e.message).slice(0, 80)) }
}
const out = [...all.values()].map(x => ({ ...x, cats: [...x.cats] }))
await fs.writeFile('harvest.json', JSON.stringify(out, null, 1))
const per = {}; for (const x of out) for (const c of x.cats) per[c] = (per[c] || 0) + 1
console.log(out.length, per, Object.fromEntries(ASPECTS.map(a => [a, out.filter(x => x.aspect === a).length])))
