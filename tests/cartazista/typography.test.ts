import { describe, it, expect } from 'vitest'
import { createCartazistaDocument, rebuildCartazistaComposition } from '~/utils/cartazista/composition'
import { applyCartazistaTypography, CARTAZISTA_TYPE_STYLES } from '~/utils/cartazista/typography'
import { cartazistaDocumentSchema } from '~/utils/cartazista/schema'

describe('fontes isoladas do cartaz',()=>{
  it.each(CARTAZISTA_TYPE_STYLES)('aplica $id sem mudar geometria nem documento original',style=>{
    const doc=createCartazistaDocument({modelId:'second-unit'})
    const original=structuredClone(doc.composition)
    const next=applyCartazistaTypography(doc.composition,style.id)
    const title=next.layers.find(l=>l.id==='cartaz-product-name')!
    expect(title.fontFamily).toBe(style.display)
    expect(title.x).toBe(original.layers.find(l=>l.id===title.id)!.x)
    expect(doc.composition).toEqual(original)
    expect(next.layers.find(l=>l.id==='cartaz-validity')).toEqual(original.layers.find(l=>l.id==='cartaz-validity'))
  })
  it('preserva textos extras e bloqueados',()=>{
    const doc=createCartazistaDocument()
    const layer=doc.composition.layers.find(l=>l.kind==='text')!
    layer.locked=true
    const custom={...layer,id:'custom-test',locked:false}
    doc.composition.layers.push(custom)
    const next=applyCartazistaTypography(doc.composition,'marker')
    expect(next.layers.find(l=>l.id===layer.id)).toEqual(layer)
    expect(next.layers.find(l=>l.id===custom.id)).toEqual(custom)
  })
  it('mantém estilo ao salvar, reabrir e reconstruir o formato',()=>{
    const doc=createCartazistaDocument()
    doc.settings.typography='handwritten'
    doc.composition=applyCartazistaTypography(doc.composition,'handwritten')
    const parsed=cartazistaDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))
    expect(parsed.settings.typography).toBe('handwritten')
    const rebuilt=rebuildCartazistaComposition({...doc,formatId:'a3'})
    expect(rebuilt.composition.layers.find(l=>l.id==='cartaz-product-name')!.fontFamily).toBe('Kalam')
  })
})
