import { describe, it, expect } from 'vitest'
import type { GlobalStyles } from '../../types/product-zone'
import { resolveProductCardColor } from '../../utils/productCardColors'
import { resolveProductNameColor, syncProductNameColor } from '../../utils/productNameColors'
import { normalizeProductPalette } from '../../utils/productPalette'

const defaults = { cardColor:'#fff4ee',highlightCardColor:'#b91c1c',prodNameColor:'#241412',highlightProdNameColor:'#fff4ee' }
const styles: Partial<GlobalStyles> = {cardColorMode:'auto', templateProductPalette:defaults}
const colors = (s: Partial<GlobalStyles>, highlighted=false, overrides={}) => {
  const background=resolveProductCardColor(s, highlighted, overrides)
  return [background,resolveProductNameColor(background,overrides,s,highlighted)]
}
describe('paleta do modelo e escolhas do usuário',()=>{
  it('aplica cores distintas do modelo aos cards comuns e destaques',()=>{
    expect(colors(styles)).toEqual(['#fff4ee','#241412'])
    expect(colors(styles,true)).toEqual(['#b91c1c','#fff4ee'])
  })
  it('mantém escolhas individuais acima da zona e do modelo após serialização',()=>{
    const saved=JSON.parse(JSON.stringify({...styles,productPalette:{cardColor:'#ffeecc',prodNameColor:'#442200'}}))
    expect(colors(saved)).toEqual(['#ffeecc','#442200'])
    expect(colors(saved,false,{cardColor:'#111111',prodNameColor:'#33cc55'})).toEqual(['#111111','#33cc55'])
    expect(colors(saved,true)).toEqual(['#b91c1c','#fff4ee'])
  })
  it('restaura defaults sem alterar o modelo e usa contraste ao trocar o fundo manualmente',()=>{
    expect(colors({...styles,productPalette:{}})).toEqual(['#fff4ee','#241412'])
    expect(colors({...styles,cardColorMode:'manual',cardColor:'#111111'})).toEqual(['#111111','#ffffff'])
    expect(colors({...styles,productPalette:{cardColor:'#111111'}})).toEqual(['#111111','#ffffff'])
    expect(colors(styles,false,{cardColor:'#111111'})).toEqual(['#111111','#ffffff'])
    expect(styles.templateProductPalette).toEqual(defaults)
  })
  it('acompanha mudança de destaque e restauração do canvas sem tocar preço ou geometria',()=>{
    const card:any={left:22,top:33,_cardHighlighted:false,objects:[{name:'offerBackground',fill:defaults.cardColor},{name:'smart_title',type:'textbox',fill:'#000000'},{name:'price',fill:'#ffcc00'}]}
    syncProductNameColor(card,styles)
    expect(card.objects[1].fill).toBe(defaults.prodNameColor)
    const copy=JSON.parse(JSON.stringify(card));copy._cardHighlighted=true;copy.objects[0].fill=resolveProductCardColor(styles,true)
    syncProductNameColor(copy,styles)
    expect(copy.objects[1].fill).toBe(defaults.highlightProdNameColor)
    expect(copy.objects[2].fill).toBe('#ffcc00');expect([copy.left,copy.top]).toEqual([22,33])
  })
  it('não muda o comportamento de modelos antigos e rejeita cores inválidas',()=>{
    expect(colors({cardColorMode:'auto',highlightCardColor:'#ff0000'},true)).toEqual(['#ff0000','#ffffff'])
    expect(colors({cardColorMode:'auto'})).toEqual(['#ffffff','#000000'])
    expect(normalizeProductPalette({cardColor:'url(secret)',prodNameColor:'#AABBCC',bad:'#ffffff'})).toEqual({prodNameColor:'#aabbcc'})
  })
})
