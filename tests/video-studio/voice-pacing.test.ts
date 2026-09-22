import {describe,it,expect} from 'vitest'
import {silenceIntervals,pacingCuts} from '../../workers/video-studio/voice-pacing.mjs'
describe('ritmo da locução de varejo',()=>{
 it('reduz pausas longas mantendo proteção nas duas bordas',()=>{
  const cuts=pacingCuts([[2,3],[4,4.2]],6)
  expect(cuts).toEqual([[2.09,2.91]])
 })
 it('detecta silêncio final e não corta pausas curtas',()=>{
  expect(silenceIntervals('silence_start: 2\nsilence_end: 2.2\nsilence_start: 5',6)).toEqual([[2,2.2],[5,6]])
  expect(pacingCuts([[2,2.2],[5,6]],6)).toEqual([[5.09,6]])
 })
 it('rejeita intervalos inválidos',()=>expect(pacingCuts([[-1,2],[3,2],[3,8],[NaN,5]],6)).toEqual([]))
})
