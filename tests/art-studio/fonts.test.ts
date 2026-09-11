import { afterEach, expect, it, vi } from 'vitest'
import { loadArtFonts } from '../../utils/art-studio/fonts'

afterEach(() => vi.unstubAllGlobals())
it('carrega o arquivo da família selecionada e preserva seu peso', async () => {
  const faces: { family: string; source: string; weight: string }[] = []
  vi.stubGlobal('FontFace', class {
    constructor(family: string, source: string, options: { weight: string }) {
      faces.push({ family, source, weight: options.weight })
    }
    async load() { return this }
  })
  vi.stubGlobal('document', { fonts: { add: vi.fn() } })
  await loadArtFonts({ layers: [
    {kind:'text',fontFamily:'Roboto Slab',fontWeight:800},
    {kind:'text',fontFamily:'Russo One',fontWeight:400},
    {kind:'text',fontFamily:'Barlow',fontWeight:800},
  ] } as any)
  expect(faces).toEqual([
    {family:'Art Roboto Slab',source:'url("/art-studio/fonts/RobotoSlab%5Bwght%5D.ttf")',weight:'800'},
    {family:'Art Russo One',source:'url("/art-studio/fonts/RussoOne-Regular.ttf")',weight:'400'},
    {family:'Art Barlow',source:'url("/art-studio/fonts/Barlow-ExtraBold.ttf")',weight:'800'},
  ])
})
