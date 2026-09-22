import {describe,it,expect} from 'vitest'
import {flyerSoundCues} from '../../shared/video-studio/sound-design'
import {newVideoFromTemplate} from '../../shared/video-studio/templates'
const scenes=[{id:'intro',from:0,frames:75},{id:'offer',from:75,frames:150},{id:'outro',from:225,frames:60}]
describe('mixagem dos modelos de encarte',()=>{
 it('usa sons curtos na entrada e preserva silêncio durante a leitura e saída sem impacto',()=>{
  const d=newVideoFromTemplate('alerta'),cues=flyerSoundCues(d,scenes,'vertical')
  expect(cues).toHaveLength(5)
  expect(cues.filter(c=>c.frame>80&&c.frame<225)).toHaveLength(0)
  expect(cues.find(c=>c.key==='price-offer')?.frame).toBe(80)
  expect(cues.filter(c=>c.frame>=225).map(c=>c.sound)).toEqual(['retail-whoosh-v1'])
  expect(Math.max(...cues.map(c=>c.gain*d.audio.effectsVolume))).toBeLessThan(.2)
 })
 it('respeita efeitos desligados e escolha explícita em projetos da revisão atual',()=>{
  const d=newVideoFromTemplate('alerta');d.audio.sounds=false
  expect(flyerSoundCues(d,scenes,'horizontal')).toEqual([])
  d.audio.sounds=true;d.motion!.accentSound='snap'
  expect(flyerSoundCues(d,scenes,'horizontal').find(c=>c.key==='price-offer')?.sound).toBe('snap')
  d.audio.effectsVolume=0;expect(flyerSoundCues(d,scenes,'horizontal')).toEqual([])
 })
 it('corrige os padrões antigos também na prévia de projetos existentes',()=>{
  const d=newVideoFromTemplate('alerta');d.templateRevision=18;d.motion!.accentSound='theme-alarm'
  expect(flyerSoundCues(d,scenes,'vertical').some(c=>c.sound==='theme-alarm')).toBe(false)
 })
})
