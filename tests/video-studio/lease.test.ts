import {describe, expect, it} from 'vitest'
import {renewVideoLease} from '../../workers/video-studio/lease.mjs'
describe('posse da geração de vídeo',()=>{
 const job={id:'render',lease_token:'owner'}
 it('não confunde uma falha de rede com outro worker',async()=>{
  expect(await renewVideoLease({query:async()=>{throw Error('ECONNRESET')}},job)).toBe('unavailable')
 })
 it('reconhece perda somente quando o banco confirma que o token não corresponde',async()=>{
  expect(await renewVideoLease({query:async()=>({rowCount:0})},job)).toBe('lost')
  expect(await renewVideoLease({query:async()=>({rowCount:1})},job)).toBe('renewed')
 })
})
