import {describe,it,expect} from 'vitest'
import {cartazistaLogoNeedsOutline, cartazistaLogoSource} from '../../utils/cartazista/logo'
const pixels=(rgb:number[])=>new Uint8ClampedArray([...rgb,255,...rgb,255,0,0,0,0])
describe('sticker automático da logo',()=>{
 it('separa marca escura do cabeçalho escuro',()=>expect(cartazistaLogoNeedsOutline(pixels([0,10,80]),'#24100b')).toBe(true))
 it('dispensa contorno para marca clara ou fundo claro',()=>{
 expect(cartazistaLogoNeedsOutline(pixels([250,250,250]),'#24100b')).toBe(false)
 expect(cartazistaLogoNeedsOutline(pixels([0,10,80]),'#ffffff')).toBe(false)
 })
 it('não cria uma placa ao redor de uma imagem opaca',()=>expect(cartazistaLogoNeedsOutline(new Uint8ClampedArray([0,10,80,255]),'#24100b')).toBe(false))
})

// No DOM is available in this suite: unchanged logos must not even be decoded.
it('preserva o arquivo original sem adicionar contorno por contraste', async () => {
 const logo = {binding:'logo',src:'/original-logo.png'} as any
 const doc = {background:'#000000',layers:[]} as any
 expect(await cartazistaLogoSource(logo,doc)).toBe('/original-logo.png')
 expect(await cartazistaLogoSource({...logo,logoOutline:false},doc)).toBe('/original-logo.png')
})
