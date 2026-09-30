import { describe, expect, it } from 'vitest'
import { buildVideoTimeline, narrationScripts, newVideoDocument, validateVideoForGeneration } from '../../shared/video-studio/model'
import { videoDocumentSchema } from '../../server/utils/video-studio/schema'

const fixture = () => {
  const doc = newVideoDocument()
  doc.offers = ['Arroz branco', 'Feijão carioca', 'Óleo de soja', 'Papel higiênico', 'Granito bovino', 'Linguiça suína'].map((name, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name, price: '6,99', unit: '', condition: '', image: '00000000-0000-4000-8000-000000000099'
  }))
  return doc
}
const narration = 'Atenção às ofertas de hoje. Arroz branco, seis reais. Feijão carioca, seis reais. Óleo de soja, seis reais. Papel higiênico, seis reais. Granito bovino, seis reais o quilo. Linguiça suína, seis reais o quilo. Aproveite no mercado.'

describe('texto livre da locução', () => {
  it.each([narration, narration.split(' ').join('\n'), narration.split('. ').join('.\n\n')])('aceita parágrafo e mais de oito linhas, preservando palavras e cenas', text => {
    const doc = fixture()
    doc.narrationText = text
    doc.scripts = narrationScripts(doc, text)!
    expect(doc.scripts.map(script => script.id)).toEqual(['intro', ...doc.offers.map(offer => offer.id), 'outro'])
    expect(doc.scripts.map(script => script.text).join(' ').replace(/\s+/g, ' ')).toBe(narration)
    for (const [index, offer] of doc.offers.entries()) expect(doc.scripts[index + 1]!.text).toContain(offer.name)
    expect(validateVideoForGeneration(doc)).toEqual([])
    expect(videoDocumentSchema.safeParse(doc).success).toBe(true)
  })
  it('não limita a 700 caracteres por cena nem a 5600 no campo', () => {
    const doc = fixture()
    const text = narration.replace('Arroz branco,', 'Arroz branco, ' + 'oferta especial '.repeat(500))
    doc.narrationText = text
    doc.scripts = narrationScripts(doc, text)!
    expect(text.length).toBeGreaterThan(5600)
    expect(doc.scripts[1]!.text.length).toBeGreaterThan(700)
    expect(videoDocumentSchema.safeParse(doc).success).toBe(true)
    expect(validateVideoForGeneration(doc)).toEqual([])
    expect(buildVideoTimeline(doc)[0]!.playbackRate).toBeGreaterThan(2)
  })
  it('conserva texto e ordem mesmo quando os nomes foram reescritos', () => {
    const doc = fixture(), text = 'Comece aproveitando agora. Café em promoção. Leite bem barato. Carne selecionada para hoje. Biscoitos para a família. Frutas frescas e saborosas. Limpeza para sua casa. Venha nos visitar.'
    const scripts = narrationScripts(doc, text)!
    expect(scripts.every(script => script.text.length > 0)).toBe(true)
    expect(scripts.map(script => script.text).join(' ')).toBe(text)
  })
  it('não cria trechos vazios quando uma âncora está perto da anterior', () => {
    const doc = fixture(), text = 'Hoje tem Arroz branco Feijão carioca Óleo de soja Papel higiênico Granito bovino Linguiça suína Aproveite agora.'
    expect(narrationScripts(doc, text)!.every(script => script.text.trim())).toBe(true)
  })
  it('adapta seis produtos a 15 segundos sem cortar o roteiro', () => {
    const doc = fixture(); doc.duration = 15; doc.scripts = narrationScripts(doc, narration)!
    const scenes = buildVideoTimeline(doc)
    expect(scenes.every(scene => scene.frames > 0)).toBe(true)
    expect(scenes.at(-1)!.from + scenes.at(-1)!.frames).toBeLessThanOrEqual(448)
  })
  it('recupera a nona linha de um projeto salvo pela versão anterior', () => {
    const doc = fixture(), lines = narration.split('. ').map((line, index, all) => index < all.length - 1 ? line + '.' : line)
    doc.scripts = narrationScripts(doc, lines.join('\n'))!
    doc.narrationText = lines.join('\n') + '\nsupermercado Rodrigues'
    const scripts = narrationScripts(doc, doc.narrationText)!
    expect(scripts.at(-1)!.text).toContain('supermercado Rodrigues')
    expect(scripts.map(script => script.text).join(' ')).toBe(narration + ' supermercado Rodrigues')
    doc.scripts = scripts
    expect(validateVideoForGeneration(doc)).toEqual([])
  })
})
