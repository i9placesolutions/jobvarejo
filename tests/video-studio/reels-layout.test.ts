import {describe,it,expect} from 'vitest'
import {reelsOfferLayout} from '../../shared/video-studio/reels-layout'

describe('selo ampliado em Reels',()=>{
 it('amplia o selo para cima e conserva a área da oferta',()=>{
  const layout=reelsOfferLayout(1.27)
  expect(layout.seal[2]).toBeGreaterThan(710)
  expect(layout.seal[1]+layout.seal[3]).toBe(625)
  expect(layout.name).toEqual([70,649,940,100])
  expect(layout.product).toEqual([60,769,960,611])
 })
 it('mantém proporção e separação com selos largos e altos',()=>{
  for(const aspect of [.5,1,2,4]){
   const layout=reelsOfferLayout(aspect),[x,y,w,h]=layout.seal
   expect(w/h).toBeCloseTo(aspect)
   expect(x).toBeGreaterThanOrEqual(80)
   expect(x+w).toBeLessThanOrEqual(1000)
   expect((y-960)*1.045+960).toBeGreaterThan(12)
   expect(y+h+24).toBe(layout.name[1])
   expect(layout.product[3]).toBeGreaterThanOrEqual(611)
  }
 })
})
