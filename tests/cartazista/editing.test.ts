import { describe,it,expect } from 'vitest'
import { createCartazistaDocument, rebuildCartazistaComposition } from '~/utils/cartazista/composition'
import { newCartazistaLayer,moveCartazistaLayer,preserveCartazistaCustomLayers,syncCartazistaBoundText } from '~/utils/cartazista/editing'
import { cartazistaDocumentSchema } from '~/utils/cartazista/schema'
describe('edição isolada de cartazes',()=>{
  it('edita o preço completo sem separar centavos e preserva o estilo no roundtrip',()=>{
    const doc=createCartazistaDocument()
    doc.settings.header={id:'11111111-1111-4111-8111-111111111111',name:'Economia',background:'',seal:'/video-studio/templates/seal.png',color:'#bb0011',layout:'thematic-seal',retailFinish:{labelFill:'#ffdd00',labelInk:'#111111',labelEdge:'#990000'}}
    const current=rebuildCartazistaComposition(doc),composition=structuredClone(current.composition)
    composition.layers.find(l=>l.id==='cartaz-price')!.text='1.299,90'
    const edited=syncCartazistaBoundText(current,composition)
    expect(edited.products[0]!.price).toBe(1299.90)
    const parsed=cartazistaDocumentSchema.parse(JSON.parse(JSON.stringify(edited)))
    expect(parsed.composition.layers.find(l=>l.id==='cartaz-price')?.richPrice).toBe(true)
    expect(rebuildCartazistaComposition(parsed as typeof edited).composition.layers.find(l=>l.id==='cartaz-price')?.text).toBe('1.299,90')
  })
  it('preserva elementos próprios ao mudar o formato',()=>{
    const doc=createCartazistaDocument();const layer=newCartazistaLayer(doc.composition,'text');doc.composition.layers.push(layer)
    const next=rebuildCartazistaComposition({...doc,formatId:'a3'})
    const result=preserveCartazistaCustomLayers(doc.composition,next.composition)
    expect(result.layers.find(l=>l.id===layer.id)?.text).toBe('SEU TEXTO')
    expect(result.layers.find(l=>l.id===layer.id)?.x).toBeCloseTo(layer.x*result.width/doc.composition.width)
  })
  it('reordena sem modificar o documento anterior e respeita bloqueio',()=>{
    const doc=createCartazistaDocument(),id=doc.composition.layers[0]!.id
    const next=moveCartazistaLayer(doc.composition,id,1)
    expect(next.layers[1]!.id).toBe(id);expect(doc.composition.layers[0]!.id).toBe(id)
    doc.composition.layers[0]!.locked=true
    expect(moveCartazistaLayer(doc.composition,id,1).layers[0]!.id).toBe(id)
  })
  it('sincroniza preço e nome editados no canvas com os dados',()=>{
    const doc=createCartazistaDocument(),composition=structuredClone(doc.composition)
    composition.layers.find(l=>l.id==='cartaz-product-name')!.text='CAFÉ'
    composition.layers.find(l=>l.id==='cartaz-price')!.text='12'
    composition.layers.find(l=>l.id==='cartaz-price-cents')!.text=',49'
    const result=syncCartazistaBoundText(doc,composition)
    expect(result.products[0]).toMatchObject({name:'CAFÉ',price:12.49})
    expect(doc.products[0]!.price).toBe(9.99)
  })
  it('valida roundtrip do arquivo editável e rejeita imagem externa ou geometria inválida',()=>{
    const doc=createCartazistaDocument();doc.composition.layers.push(newCartazistaLayer(doc.composition,'rect'))
    expect(cartazistaDocumentSchema.safeParse(JSON.parse(JSON.stringify(doc))).success).toBe(true)
    doc.composition.layers[0]!.width=-4
    expect(cartazistaDocumentSchema.safeParse(doc).success).toBe(false)
    doc.composition.layers[0]!.width=40;doc.composition.layers[0]!.src='https://example.com/tracker.png'
    expect(cartazistaDocumentSchema.safeParse(doc).success).toBe(false)
  })
})
