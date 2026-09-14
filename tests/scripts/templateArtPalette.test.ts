import {it,expect} from 'vitest'
import sharp from 'sharp'
import {paletteFromArtwork,applyArtworkPalette} from '../../scripts/lib/template-art-palette.mjs'
it('usa a cor do fundo e remove a faixa azul fixa do rodapé',async()=>{
 const red=await sharp({create:{width:40,height:40,channels:3,background:'#d02010'}}).png().toBuffer()
 const palette=await paletteFromArtwork(red)
 expect(parseInt(palette.main.slice(1,3),16)).toBeGreaterThan(parseInt(palette.main.slice(5,7),16))
 const canvas={objects:[{name:'footer-premium-background',fill:'#0636a7'},{name:'header-validity',fill:'#07196a'},{name:'standard-validity-background',fill:'#ffe500'}]}
 applyArtworkPalette(canvas,palette)
 expect(canvas.objects[0].fill).toBe('transparent')
 expect(canvas.objects[1].fill).toBe(palette.ink)
 expect(canvas.objects[2].fill).toBe(palette.surface)
})
