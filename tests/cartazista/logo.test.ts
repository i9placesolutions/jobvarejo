import {describe,it,expect} from 'vitest'
import {cartazistaLogoNeedsOutline} from '../../utils/cartazista/logo'
const pixels=(rgb:number[])=>new Uint8ClampedArray([...rgb,255,...rgb,255,0,0,0,0])
describe('sticker automático da logo',()=>{
 it('separa marca escura do cabeçalho escuro',()=>expect(cartazistaLogoNeedsOutline(pixels([0,10,80]),'#24100b')).toBe(true))
 it('dispensa contorno para marca clara ou fundo claro',()=>{
 expect(cartazistaLogoNeedsOutline(pixels([250,250,250]),'#24100b')).toBe(false)
 expect(cartazistaLogoNeedsOutline(pixels([0,10,80]),'#ffffff')).toBe(false)
 })
 it('não cria uma placa ao redor de uma imagem opaca',()=>expect(cartazistaLogoNeedsOutline(new Uint8ClampedArray([0,10,80,255]),'#24100b')).toBe(false))
})
