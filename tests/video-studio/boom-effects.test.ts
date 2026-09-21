import {describe,it,expect} from 'vitest'
import {BOOM_THEMES,isBoomTheme,explosionEnvelope} from '../../shared/video-studio/boom-effects'
describe('Boom campaign timing',()=>{
 it('only applies to the two Boom models',()=>{expect(BOOM_THEMES).toHaveLength(2);expect(isBoomTheme('alerta')).toBe(false)})
 it('matches sound onset and ends before the reading hold',()=>{
  for(const opening of [true,false]){
   const hit=opening?8:5
   expect(explosionEnvelope(hit-1,opening).active).toBe(false)
   expect(explosionEnvelope(hit,opening).flash).toBe(1)
   expect(explosionEnvelope(hit+12,opening).expansion).toBeGreaterThan(.7)
   for(const frame of [hit+38,100,200])expect(explosionEnvelope(frame,opening).active).toBe(false)
  }
 })
})
