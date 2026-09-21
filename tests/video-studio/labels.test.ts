import {describe,it,expect} from 'vitest'
import {adaptVideoLabel} from '../../shared/video-studio/labels'
const template=()=>({id:'label',name:'Amarela',group:{width:300,height:180,objects:[{type:'Rect',fill:'#ffff00',width:300,height:180},{type:'IText',name:'price_integer_text',text:'12',fontSize:100,fill:'#000000'}]}})
describe('reutilização isolada das etiquetas',()=>{
 it('produz cópia e preserva catálogo original',()=>{const t=template(),snapshot=JSON.stringify(t);const result=adaptVideoLabel(t)!;result.nodes[0]!.fill='#ff0000';expect(JSON.stringify(t)).toBe(snapshot);expect(result.nodes[1]!.name).toBe('price_integer_text')})
 it('não importa etiquetas de múltiplos preços como preço simples',()=>{const t=template();t.name='Atacarejo 2 preços';expect(adaptVideoLabel(t)).toBeNull()})
 it('recusa imagens externas e tipos de objetos não suportados',()=>{const t=template();(t.group.objects as any[]).push({type:'Image',src:'https://attacker.example/a.png'});expect(adaptVideoLabel(t)).toBeNull();(t.group.objects as any[])[2]={type:'unknown'};expect(adaptVideoLabel(t)).toBeNull()})
 it('descarta valores de cor que tentem carregar URL externa',()=>{const t=template();t.group.objects[0]!.fill='url(https://attacker.example/image)';expect(adaptVideoLabel(t)!.nodes[0]!.fill).toBe('#ffffff')})
})
