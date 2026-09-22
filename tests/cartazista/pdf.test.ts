import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { cartazistaPdfSize, createCartazistaPdf } from '~/utils/cartazista/pdf'
import { createCartazistaDocument } from '~/utils/cartazista/composition'

const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
describe('cartazista PDF físico',()=>{
  it('mantém 200 × 62 cm, sem confundir pixels com pontos',async()=>{
    const doc=createCartazistaDocument({modelId:'banner-2m'})
    const pdf=await PDFDocument.load(await createCartazistaPdf([doc.composition],doc.formatId,async()=>pixel))
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getPage(0).getWidth()*25.4/72).toBeCloseTo(2000)
    expect(pdf.getPage(0).getHeight()*25.4/72).toBeCloseTo(620)
  })
  for(const [format,count] of [['a5',2],['a6',4],['a7',8]] as const){
    it(`organiza ${count} cartazes ${format} em uma folha A4`,async()=>{
      const doc=createCartazistaDocument({formatId:format})
      const pdf=await PDFDocument.load(await createCartazistaPdf(Array(count+1).fill(doc.composition),format,async()=>pixel,'a4'))
      expect(pdf.getPageCount()).toBe(2)
      expect([pdf.getPage(0).getWidth(),pdf.getPage(0).getHeight()].sort((a,b)=>a-b)).toEqual(cartazistaPdfSize('a4',false))
    })
  }
  it('divide peças grandes em A4 sem redimensionar o cartaz',async()=>{
    const doc=createCartazistaDocument({formatId:'a3'})
    const pdf=await PDFDocument.load(await createCartazistaPdf([doc.composition],'a3',async()=>pixel,'a4'))
    expect(pdf.getPageCount()).toBeGreaterThan(1)
    for(const page of pdf.getPages())expect(page.getSize()).toEqual({width:cartazistaPdfSize('a4',false)[0],height:cartazistaPdfSize('a4',false)[1]})
  })
})
