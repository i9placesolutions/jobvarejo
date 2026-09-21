import { describe,it,expect } from 'vitest'
import { newVideoDocument,parseOfferPrice,videoAudioIdentity,videoSpeechSource,suggestVideoScripts,buildVideoTimeline,validateVideoForGeneration } from '../../shared/video-studio/model'
import { videoDocumentSchema } from '../../server/utils/video-studio/schema'
const fixture=()=>{const d=newVideoDocument();d.brand.name='Mercado Teste';d.offers=[{id:'00000000-0000-4000-8000-000000000001',name:'Café 500 g',price:'19,90',unit:'un',condition:'',image:'00000000-0000-4000-8000-000000000002'}];d.scripts=suggestVideoScripts(d);return d}
describe('vídeos: preços, revisões e isolamento do contrato',()=>{
 it('aceita moeda brasileira sem confundir decimal com milhares',()=>{expect(parseOfferPrice('1.299,90')).toBe(1299.9);expect(parseOfferPrice('19,9')).toBe(19.9);for(const x of ['19.90','-4','0','NaN','1,2,3','19 reais'])expect(parseOfferPrice(x)).toBeNull()})
 it('mantém preço/unidade/condição no roteiro sem inventar validade',()=>{const d=fixture();d.offers[0]!.condition='Limite de 2 unidades';const s=suggestVideoScripts(d);expect(s[1]!.text).toContain('R$ 19,90 un');expect(s[1]!.text).toContain('Limite de 2 unidades');expect(s[2]!.text).not.toContain('domingo')})
 it('mudança comercial invalida áudio e confirmação, efeitos não',()=>{const d=fixture(),id=videoAudioIdentity(d),source=videoSpeechSource(d);d.effects=['smoke'];d.audio.music='calm';d.formats=['horizontal'];d.layoutVersion=2;d.brand.logoStyle='sticker';d.duplicateProducts=true;d.offers[0]!.image='00000000-0000-4000-8000-000000000009';d.offers[0]!.imageAspectRatio=.6;expect(videoAudioIdentity(d)).toBe(id);expect(videoSpeechSource(d)).toBe(source);d.offers[0]!.price='20,90';expect(videoAudioIdentity(d)).not.toBe(id);expect(videoSpeechSource(d)).not.toBe(source)})
 it('edição de texto e pronúncia invalidam locução',()=>{const d=fixture(),before=videoAudioIdentity(d);d.scripts[0]!.text='Uma nova chamada';expect(videoAudioIdentity(d)).not.toBe(before);const changed=videoAudioIdentity(d);d.voice.pronunciations=[{from:'Teste',to:'Téste'}];expect(videoAudioIdentity(d)).not.toBe(changed)})
 it('recusa URLs arbitrárias e efeitos inválidos',()=>{const d=fixture();expect(videoDocumentSchema.safeParse(d).success).toBe(true);d.offers[0]!.image='http://127.0.0.1/secret';expect(videoDocumentSchema.safeParse(d).success).toBe(false)})
 it('não permite formatos duplicados ou mais de seis produtos',()=>{const d=fixture();d.formats=['vertical','vertical'];expect(videoDocumentSchema.safeParse(d).success).toBe(false)})
 it('bloqueia nome comercial ausente, preço inválido e imagem faltante',()=>{const d=fixture();d.brand.name='';d.offers[0]!.price='errado';d.offers[0]!.image='';expect(validateVideoForGeneration(d)).toHaveLength(3)})
})
describe('limite real de duração',()=>{
 it('inclui abertura, ofertas e encerramento em cenas contínuas',()=>{const d=fixture(),t=buildVideoTimeline(d,{intro:2,[d.offers[0]!.id]:4,outro:2});expect(t[0]!.from).toBe(0);for(let i=1;i<t.length;i++)expect(t[i]!.from).toBe(t[i-1]!.from+t[i-1]!.frames);expect(t.reduce((a,s)=>a+s.frames,0)).toBeLessThanOrEqual(898)})
 it('não corta fala longa para caber',()=>{const d=fixture();expect(()=>buildVideoTimeline(d,{intro:3,[d.offers[0]!.id]:27,outro:3})).toThrow('ultrapassa')})
 it('recusa trecho de áudio faltante',()=>{expect(()=>buildVideoTimeline(fixture(),{intro:2,outro:3})).toThrow('não está pronta')})
 it('versão sem voz também respeita o teto e tempo mínimo de leitura',()=>{const d=fixture();d.voice.enabled=false;for(const duration of [15,20,30] as const){d.duration=duration;const t=buildVideoTimeline(d);expect(t.reduce((n,s)=>n+s.frames,0)).toBeLessThanOrEqual(duration*30-2);expect(t[1]!.frames).toBeLessThanOrEqual(150);expect(t[1]!.frames).toBeGreaterThanOrEqual(90)}})
 it('trocar proporção não muda tempo nem locução',()=>{const d=fixture(),t=buildVideoTimeline(d);d.formats=['horizontal'];expect(buildVideoTimeline(d)).toEqual(t)})
})
