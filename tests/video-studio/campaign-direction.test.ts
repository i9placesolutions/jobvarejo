import {describe,it,expect} from 'vitest'
import {classifyCampaign,campaignFamily,campaignSound,CAMPAIGN_FAMILIES} from '../../shared/video-studio/campaign-direction'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
import {SOUND_EFFECTS} from '../../shared/video-studio/effect-catalog'
import {musicGain} from '../../shared/video-studio/sound-design'
import {newVideoFromTemplate} from '../../shared/video-studio/templates'
describe('Direção temática do catálogo',()=>{
 it.each([['Dia D de Ofertas — Verde','impact'],['Dia das Crianças','children'],['Quinta da carne','grill'],['Segunda suína','grill'],['Oferta Relâmpago — Azul','lightning'],['Oferta da Feira — Vermelho','harvest'],['Outubro Queima de Estoque','clearance'],['Promoção das Crianças','children'],['Ofertas de Halloween','spooky'],['Oferta da Semana — Coração','rose'],['Fecha Mês Outubro','clock'],['Boom de Ofertas','boom']])('%s tem família coerente',(name,family)=>expect(classifyCampaign(name)).toBe(family))
 it('reconhece a arte de padaria apesar do nome genérico',()=>expect(classifyCampaign('Ofertas da semana','c69acb2e-1446-40a5-913e-82cfd822cffc')).toBe('bakery'))
 it('preserva famílias visuais e usa acentos curtos sem explosões repetidas',()=>{
  const used=new Set()
  for(const r of Object.values(FLYER_RECIPES)){
   const family=campaignFamily(r.id)!;used.add(family)
   if(family==='children')expect(r.backgroundKind).toBe('celebration')
   if(family==='clock')expect(r.backgroundKind).toBe('clock')
   if(family==='grill'||family==='clearance')expect(r.backgroundKind).toBe('embers')
   expect(SOUND_EFFECTS.some(s=>s.id===campaignSound(family))).toBe(true)
   expect(r.motion.accentSound).toBe('retail-pop-v1')
   const d=newVideoFromTemplate(r.id);d.voice.enabled=false
   const scenes=[{id:'intro',from:0,frames:90}]
   expect(musicGain(8,300,d,scenes)).toBeLessThan(musicGain(60,300,d,scenes))
  }
  expect(used.size).toBe(CAMPAIGN_FAMILIES.length)
 })
})
