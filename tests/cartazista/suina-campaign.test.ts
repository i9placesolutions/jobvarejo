import {describe,it,expect} from 'vitest'
import {createCartazistaDocument,rebuildCartazistaComposition} from '../../utils/cartazista/composition'
import {hydrateCartazistaBusiness} from '../../utils/cartazista/business-bindings'
import {cartazistaDocumentSchema} from '../../utils/cartazista/schema'
import {CARTAZISTA_FORMATS} from '../../types/cartazista'
describe('Famílias Quarta Suína',()=>{
 for(const variant of ['suina-ouro','suina-rustica'] as const)for(const format of CARTAZISTA_FORMATS)it(`${variant} ${format.id}: mantém personagem separado e bindings`,()=>{
 const d=createCartazistaDocument({themeId:variant,formatId:format.id,modelId:format.id==='banner-2m'?'banner-2m':'standard'});d.settings.header={id:'e092b15b-fb4b-4f32-8978-dc023c1f8c2d',name:'Quarta Suína',background:'/video-studio/templates/bg.png',seal:'/video-studio/templates/seal.png',mascot:'/video-studio/templates/pig.png',layout:variant,color:'#10100e'};const r=rebuildCartazistaComposition(d);expect(cartazistaDocumentSchema.safeParse(r).success).toBe(true);expect(r.composition.layers.filter(l=>l.binding==='logo')).toHaveLength(1);expect(r.composition.layers.some(l=>l.id==='cartaz-campaign-mascot')).toBe(true);
 const profile={companyName:'Loja B',whatsapp:'11999999999',address:'Endereço B',instagram:'@lojaB'};const b=hydrateCartazistaBusiness(r.composition,profile,'/logo-b.png');expect(b.layers.some(l=>['phone','address','instagram'].includes(l.binding||''))).toBe(false);expect(b.layers.find(l=>l.binding==='logo')?.src).toBe('/logo-b.png');
 const empty=hydrateCartazistaBusiness(b,{companyName:'',whatsapp:'',address:'',instagram:''},'');expect(empty.layers.filter(l=>l.binding&&l.visible)).toHaveLength(0);expect(r.composition.layers.find(l=>l.id==='cartaz-price')?.fontFamily).toBe('Knewave');
 });
});
