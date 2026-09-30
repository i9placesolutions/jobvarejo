import {describe,expect,it} from 'vitest'
import {selectVoicePlaybackJob} from '../../shared/video-studio/voice-selection'

const ready=(id:string,audioIdentity?:string)=>({id,kind:'voice',status:'ready',result:{provider:'elevenlabs',audioIdentity,fullVoice:{assetId:`asset-${id}`,duration:27}}})

describe('seleção do áudio para ouvir',()=>{
 it('prefere o job exato atual mesmo quando outro pronto aparece primeiro',()=>{
  const current=ready('current')
  expect(selectVoicePlaybackJob([ready('newer-stale'),current],current)).toBe(current)
 })

 it('mantém o último áudio pronto disponível quando o roteiro atual não corresponde',()=>{
  const latest=ready('latest-stale')
  expect(selectVoicePlaybackJob([latest,ready('older-stale')],undefined)).toBe(latest)
 })

 it('não seleciona jobs sem áudio ElevenLabs pronto e válido',()=>{
  const jobs=[
   {...ready('failed'),status:'failed'},
   {...ready('music'),kind:'music'},
   {...ready('wrong-provider'),result:{provider:'musicgpt',fullVoice:{assetId:'asset',duration:10}}},
   {...ready('empty'),result:{provider:'elevenlabs',fullVoice:null,clips:{intro:{assetId:'',duration:10}}}},
   {...ready('invalid-clip'),result:{provider:'elevenlabs',fullVoice:null,clips:{intro:{assetId:'asset',duration:0}}}}
  ]
  expect(selectVoicePlaybackJob(jobs,undefined)).toBeUndefined()
 })

 it('aceita uma locução válida composta por trechos',()=>{
  const clips={intro:{assetId:'asset-intro',duration:3},outro:{assetId:'asset-outro',duration:4}}
  const job={id:'clips',kind:'voice',status:'ready',result:{provider:'elevenlabs',clips}}
  expect(selectVoicePlaybackJob([job],undefined)).toBe(job)
 })
})
