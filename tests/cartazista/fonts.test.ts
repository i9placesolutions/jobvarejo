import { it, expect, vi, afterEach } from 'vitest'
import { createCartazistaDocument } from '~/utils/cartazista/composition'
vi.mock('~/utils/art-studio/fonts',()=>({loadArtFonts:vi.fn(async()=>{})}))
import { loadArtFonts } from '~/utils/art-studio/fonts'
import { loadCartazistaFonts } from '~/utils/cartazista/fonts'
afterEach(()=>vi.unstubAllGlobals())
it('carrega lettering local sem fallback genérico e reutiliza a fonte',async()=>{
  const loaded=vi.fn(async()=>{}),add=vi.fn()
  vi.stubGlobal('FontFace',class {load=loaded;constructor(public family:string,public source:string){}})
  vi.stubGlobal('document',{fonts:{add}})
  const doc=createCartazistaDocument().composition
  doc.layers=doc.layers.filter(l=>l.kind==='text').slice(0,1)
  doc.layers[0]!.fontFamily='Luckiest Guy'
  await loadCartazistaFonts(doc)
  await loadCartazistaFonts(doc)
  expect(loaded).toHaveBeenCalledTimes(1)
  expect(add).toHaveBeenCalledWith(expect.objectContaining({family:'Art Luckiest Guy',source:'url("/cartazista/fonts/LuckiestGuy-Regular.ttf")'}))
  expect(vi.mocked(loadArtFonts).mock.calls[0]![0].layers).toHaveLength(0)
})
