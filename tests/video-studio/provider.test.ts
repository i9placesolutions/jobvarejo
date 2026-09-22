import {describe,it,expect} from 'vitest'
import {requestVideoAudio} from '../../workers/video-studio/provider.mjs'
const reply=(data:any,status=200)=>({ok:status===200,status,json:async()=>data})
async function run(sequence:any[],state:any={},type='TEXT_TO_SPEECH'){
 const calls:any[]=[];const saved:any[]=[];const job={provider_state:state}
 const promise=requestVideoAudio({job,label:'intro',payload:{text:'Oferta'},type,endpoint:'https://example.test/TextToSpeech',key:'test',sleep:async()=>{},pollLimit:12,checkpoint:async(_j:any,s:any)=>{saved.push(JSON.parse(JSON.stringify(s)))},fetcher:async(_u:any,options:any)=>{calls.push(options.method||'GET');const next=sequence.shift();if(next instanceof Error)throw next;return next||reply({status:'IN_QUEUE'})}})
 return {promise,calls,saved}
}
describe('recuperação da locução',()=>{
 it('retoma task existente e tolera erro de rede sem POST duplicado',async()=>{const r=await run([new Error('network'),reply({conversion:{conversion_path:'https://cdn.test/a.mp3'}})],{intro:{taskId:'original'}});expect((await r.promise).url).toContain('a.mp3');expect(r.calls).toEqual(['GET','GET'])})
 it('não cria outra cobrança após timeout',async()=>{const r=await run([reply({status:'TIMEOUT'})],{intro:{taskId:'original'}});await expect(r.promise).rejects.toThrow('Nenhuma nova geração paga');expect(r.calls).toEqual(['GET'])})
 it('não repete POST cuja resposta se perdeu',async()=>{const r=await run([new Error('network')]);await expect(r.promise).rejects.toThrow();expect(r.calls).toEqual(['POST']);const resumed=await run([],{intro:{sending:true}});await expect(resumed.promise).rejects.toThrow('incerta');expect(resumed.calls).toEqual([])})
 it('reaproveita áudio pronto sem chamar provedor',async()=>{const r=await run([],{intro:{asset:{id:'saved'}}});expect(await r.promise).toEqual({id:'saved'});expect(r.calls).toEqual([])})
 it('não refaz música após timeout',async()=>{const r=await run([reply({status:'TIMEOUT'})],{intro:{taskId:'music'}},'MUSIC_AI');await expect(r.promise).rejects.toThrow();expect(r.calls).toEqual(['GET'])})
 it('interrompe por saldo sem repetir e permite retomada explícita depois',async()=>{const r=await run([reply({},402)]);await expect(r.promise).rejects.toThrow('créditos');expect(r.calls).toEqual(['POST']);const state=r.saved.at(-1);expect(state.intro.rejectedHttp).toBe(402);expect(state.intro.sending).toBe(false);const resumed=await run([reply({task_id:'restored'}),reply({conversion_path:'https://cdn.test/restored.mp3'})],state);await resumed.promise;expect(resumed.calls).toEqual(['POST','GET'])})
 it('limita rejeições por excesso de solicitações',async()=>{const r=await run([reply({},429),reply({},429),reply({},429)]);await expect(r.promise).rejects.toThrow('429');expect(r.calls).toEqual(['POST','POST','POST'])})

})
