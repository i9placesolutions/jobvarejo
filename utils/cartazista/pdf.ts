import type { ArtComposition } from '~/types/art-studio'
import type { CartazistaFormatId } from '~/types/cartazista'

const MM_TO_PT = 72 / 25.4
const SIZES: Record<CartazistaFormatId, [number, number]> = {
  a1: [594, 841], a2: [420, 594], a3: [297, 420], a4: [210, 297],
  a5: [148, 210], a6: [105, 148], a7: [74, 105], 'banner-2m': [2000, 620]
}

/** Dimensões físicas independentes da resolução do canvas. */
export function cartazistaPdfSize(format: CartazistaFormatId, landscape: boolean): [number, number] {
  const [w,h] = SIZES[format]
  return (format !== 'banner-2m' && landscape ? [h,w] : [w,h]).map(value=>value*MM_TO_PT) as [number,number]
}

export async function createCartazistaPdf(
  compositions: ArtComposition[],
  format: CartazistaFormatId,
  render: (composition: ArtComposition) => Promise<string>,
  mode: 'actual' | 'a4' = 'actual'
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setCreator('JobVarejo · Editor de Cartazes')
  let sheet: ReturnType<typeof pdf.addPage> | undefined
  let slot = 0
  for (const composition of compositions) {
    const [width,height] = cartazistaPdfSize(format, composition.width > composition.height)
    const image = await pdf.embedPng(await render(composition))
    if (mode === 'actual') {
      pdf.addPage([width,height]).drawImage(image,{x:0,y:0,width,height})
      continue
    }
    // A5/A7 de pé ocupam melhor uma folha A4 deitada.
    const landscapeSheet = ['a5','a7'].includes(format) ? composition.width < composition.height : composition.width > composition.height
    const [pageW,pageH] = cartazistaPdfSize('a4',landscapeSheet)
    const cols = Math.floor((pageW+.1)/width), rows = Math.floor((pageH+.1)/height)
    if(cols && rows) {
      if(!sheet || slot >= cols*rows){sheet=pdf.addPage([pageW,pageH]);slot=0}
      const x=(pageW-cols*width)/2+(slot%cols)*width
      const y=pageH-(pageH-rows*height)/2-(Math.floor(slot/cols)+1)*height
      sheet.drawImage(image,{x,y,width,height});slot++
    } else {
      // Poster grande: mosaico A4 com recorte por página, sem reduzir a escala.
      sheet=undefined;slot=0
      const columns=Math.ceil(width/pageW), lines=Math.ceil(height/pageH)
      for(let row=0;row<lines;row++) for(let column=0;column<columns;column++) {
        pdf.addPage([pageW,pageH]).drawImage(image,{x:-column*pageW,y:pageH-height+row*pageH,width,height})
      }
    }
  }
  return pdf.save()
}
