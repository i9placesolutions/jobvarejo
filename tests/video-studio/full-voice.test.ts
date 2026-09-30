import {describe,it,expect} from 'vitest'
import {newVideoDocument} from '../../shared/video-studio/model'
import {fullVoiceTimeline} from '../../shared/video-studio/full-voice'
import {fullVoiceText,voiceBoundaries,voiceUsage} from '../../workers/video-studio/full-voice.mjs'
describe('locução completa econômica',()=>{
 it('une o roteiro inteiro numa solicitação preservando conteúdo e ordem',()=>{expect(fullVoiceText([{text:'Loja!'},{text:'Batata por três reais'},{text:'Aproveite.'}])).toBe('Loja. Batata por três reais. Aproveite.')})
 it('mede consumo internamente sem impedir o cliente por custo',()=>{const text=fullVoiceText([{text:'oferta '.repeat(101)}]);expect(voiceUsage(text)).toEqual({words:101,billingUnits:2,requests:1})})
 it('sincroniza cenas em pausas próximas sem cortar o áudio',()=>{expect(voiceBoundaries([{text:'um dois'},{text:'três quatro'}],10,[4.8])).toEqual([0,4.8,10])})
 it('acelera um único áudio de 35 segundos para menos de 30 sem lacunas',()=>{const doc=newVideoDocument();doc.offers=[{id:'offer'}] as any;doc.duration=30;const scenes=fullVoiceTimeline(doc,{assetId:'full',duration:35,boundaries:[0,5,29,35]});expect(scenes.map(s=>s.id)).toEqual(['intro','offer','outro']);expect(scenes[1]!.from).toBe(scenes[0]!.frames);expect(scenes[2]!.from).toBe(scenes[1]!.from+scenes[1]!.frames);expect(scenes.reduce((n,s)=>n+s.frames,0)).toBeLessThanOrEqual(898);expect(scenes[0]!.playbackRate).toBeGreaterThan(1)})
 it('rejeita metadados inválidos sem produzir áudio truncado',()=>{const doc=newVideoDocument();expect(()=>fullVoiceTimeline(doc,{assetId:'a',duration:20,boundaries:[0,20,10]})).toThrow()})
 it('ajusta a duração real recebida acima de 2x sem perder o encerramento',()=>{const doc=newVideoDocument();doc.offers=[{id:'offer'}] as any;const voice={assetId:'original',duration:120,boundaries:[0,20,100,120]};const scenes=fullVoiceTimeline(doc,voice);expect(scenes[0]!.playbackRate).toBeGreaterThan(4);expect(scenes.at(-1)!.id).toBe('outro');expect(scenes.at(-1)!.from+scenes.at(-1)!.frames).toBeLessThanOrEqual(898);expect(voice).toEqual({assetId:'original',duration:120,boundaries:[0,20,100,120]});doc.duration=15;expect(fullVoiceTimeline(doc,voice)[0]!.playbackRate).toBeGreaterThan(8)})
 it('orienta ativar o ajuste quando desabilitado e conserva o áudio salvo',()=>{const doc=newVideoDocument();doc.autoFitVoice=false;expect(()=>fullVoiceTimeline(doc,{assetId:'original',duration:40,boundaries:[0,10,40]})).toThrow('O áudio gerado está salvo')})
})
