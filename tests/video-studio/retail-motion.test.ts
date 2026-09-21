import {describe, expect, it} from 'vitest'
import {retailEntrance, retailExit, retailImpact, retailTransition} from '../../shared/video-studio/retail-motion'

describe('movimento de varejo', () => {
  it('revela a embalagem por escala, sem viajar uma largura de tela', () => {
    for (let frame = 0; frame <= 30; frame++) {
      const enter = retailEntrance(frame)
      expect(enter.travel * 32).toBeLessThanOrEqual(32)
      expect(enter.scale).toBeGreaterThanOrEqual(.58)
      expect(enter.scale).toBeLessThanOrEqual(1.035)
    }
    expect(retailEntrance(2).opacity).toBe(1)
    expect(retailEntrance(12).scale).toBe(1)
    expect(retailEntrance(2, 5).opacity).toBe(0)
  })
  it('encerra o shake e o desfoque antes do período de leitura', () => {
    for (const mode of ['light', 'slide', 'smoke', 'fade'] as const) {
      expect(retailTransition(20, mode)).toEqual({energy: 0, flash: 0, zoom: 0, x: 0, blur: 0})
    }
    expect(retailImpact(18)).toEqual({x: 0, y: 0, rotation: 0, zoom: 0})
    expect(retailExit(100, 176)).toEqual({opacity: 1, scale: 1, blur: 0})
  })
  it('sai por redução e preserva limites ao buscar frames fora da cena', () => {
    expect(retailExit(176, 176).opacity).toBe(0)
    expect(retailExit(200, 176).opacity).toBe(0)
    expect(retailEntrance(-20).opacity).toBe(0)
    expect(retailImpact(-1).zoom).toBe(0)
  })
})

import {cameraMotion,elementMotion} from '../../shared/video-studio/catalog-motion'
describe('leitura estável do preço',()=>{
 it('encerra todos os movimentos de câmera após o impacto de entrada',()=>{
  for(const mode of ['impact','swing','handheld','earthquake','zoom-pulse'] as const){
   expect(cameraMotion(8,8,mode,1)).not.toEqual({x:0,y:0,rotation:0,zoom:0})
   for(const frame of [24,30,45,60,90,150])expect(cameraMotion(frame+210,frame,mode,1)).toEqual({x:0,y:0,rotation:0,zoom:0})
  }
 })
 it('mantém o tamanho e a posição do preço entre a entrada e a saída',()=>{
  for(const mode of ['slam','whip-left','whip-right','rise','drop','tilt','elastic','zoom-out'] as const)
   for(const frame of [30,45,60,90,150])expect(JSON.parse(JSON.stringify(elementMotion(frame-5,mode,0,'balanced')))).toEqual({x:0,y:0,rotation:0,scale:1,opacity:1,progress:1})
 })
})
