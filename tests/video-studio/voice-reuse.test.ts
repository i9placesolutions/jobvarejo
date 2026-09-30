import {describe,expect,it} from 'vitest'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {newVideoDocument,narrationScripts,validateVideoForGeneration,videoAudioIdentity,videoAudioIdentityMatches,videoNarrationText,videoSpeechSource} from '../../shared/video-studio/model'
import {mergeVoiceReuseDocument,prepareVoiceReuse} from '../../shared/video-studio/voice-reuse'

function fixture(){
 const document=newVideoDocument()
 document.duration=30
 document.offers=[{id:'86db1b37-2330-43f4-9350-1ff42bdde821',name:'Refrigerante Skol',price:'2,69',unit:'un',condition:'',image:'c5aef9a8-770d-4e98-bc40-ac779a8f52b6'}]
 document.scripts=[{id:'intro',text:'Oferta do dia.'},{id:document.offers[0]!.id,text:'Skol por dois reais.'},{id:'outro',text:'Aproveite.'}]
 document.narrationText=document.scripts.map(script=>script.text).join('\n')
 document.layoutEdits={vertical:{intro:{seal:{x:18,y:24,scale:1.2,rotation:0}}}}
 const sourceDocument=structuredClone(document)
 sourceDocument.offers[0]!.price='2,79'
 sourceDocument.voice={enabled:true,id:'voz-anterior',pronunciations:[{from:'Skol',to:'iscól'}]}
 sourceDocument.scripts=[{id:'intro',text:'Promoção.'},{id:sourceDocument.offers[0]!.id,text:'Skol por dois reais e setenta e nove centavos.'},{id:'outro',text:'Confira.'}]
 const fullVoice={assetId:'7af9eecd-7988-4967-a0f7-660089b7a233',duration:10,boundaries:[0,2,7,10]}
 const result={provider:'elevenlabs',audioIdentity:videoAudioIdentity(sourceDocument),fullVoice}
 return {document,result,fullVoice}
}

describe('reutilização explícita de locução',()=>{
 it('restaura roteiro e voz, sem alterar ofertas nem layout, e recalcula identidade e timeline',()=>{
  const {document,result,fullVoice}=fixture()
  const plan=prepareVoiceReuse(document,result.audioIdentity,result)
  expect(plan.document.offers).toEqual(document.offers)
  expect(plan.document.layoutEdits).toEqual(document.layoutEdits)
  expect(plan.document.scripts[1]?.text).toContain('setenta e nove centavos')
  expect(plan.document.narrationText).toBe(plan.document.scripts.map(script=>script.text).join('\n'))
  expect(plan.document.voice).toEqual({enabled:true,id:'voz-anterior',pronunciations:[{from:'Skol',to:'iscól'}]})
  expect(plan.scriptSource).not.toBe('')
  expect(plan.scriptSource).toBe(videoSpeechSource(videoDocumentSchema.parse(plan.document)))
  expect(JSON.parse(plan.audioIdentity).source).toBe(plan.scriptSource)
  expect(plan.audioIdentity).toBe(videoAudioIdentity(videoDocumentSchema.parse(plan.document)))
  expect(plan.scenes.map(scene=>scene.id)).toEqual(['intro',document.offers[0]!.id,'outro'])
  expect(plan.scenes.at(-1)?.from!+plan.scenes.at(-1)!.frames).toBeGreaterThan(0)
  expect(videoDocumentSchema.safeParse(plan.document).success).toBe(true)
  expect(fullVoice.assetId).toBe(plan.fullVoice.assetId)
 })

 it('rejeita IDs ou ordem de produtos que não correspondem ao vídeo atual',()=>{
  const {document,result}=fixture()
  const stored=JSON.parse(result.audioIdentity)
  stored.scripts[1].id='fa00fa00-0000-4000-8000-000000000000'
  expect(()=>prepareVoiceReuse(document,JSON.stringify(stored),result)).toThrow(/ordem dos produtos/)

  const reorderedDocument=structuredClone(document)
  const secondOffer={...reorderedDocument.offers[0]!,id:'177c98a0-bf91-42e7-8cb5-047bb7b9d69e'}
  reorderedDocument.offers.push(secondOffer)
  const reorderedIdentity=JSON.parse(result.audioIdentity)
  reorderedIdentity.scripts=[
   {id:'intro',text:'Promoção.'},
   {id:secondOffer.id,text:'Segunda oferta.'},
   {id:reorderedDocument.offers[0]!.id,text:'Primeira oferta.'},
   {id:'outro',text:'Confira.'}
  ]
  expect(()=>prepareVoiceReuse(reorderedDocument,JSON.stringify(reorderedIdentity),result)).toThrow(/ordem dos produtos/)
 })

 it('rejeita gravação sem fullVoice válido ou provider ElevenLabs',()=>{
  const {document,result}=fixture()
  expect(()=>prepareVoiceReuse(document,result.audioIdentity,{...result,fullVoice:null})).toThrow(/locução completa válida/)
  expect(()=>prepareVoiceReuse(document,result.audioIdentity,{...result,provider:'musicgpt'})).toThrow(/ElevenLabs/)
 })

 it('valida os limites do fullVoice contra a timeline do documento atual',()=>{
  const {document,result}=fixture()
  expect(()=>prepareVoiceReuse(document,result.audioIdentity,{...result,fullVoice:{...result.fullVoice,boundaries:[0,2,2,10]}})).toThrow(/Sincronização/)
 })

 it('normaliza a ordem das chaves da configuração de voz para identidade e hash de exportação estáveis',()=>{
  const {document,result}=fixture(),stored=JSON.parse(result.audioIdentity)
  stored.voice={id:'voz-anterior',pronunciations:[{from:'Skol',to:'iscól'}],enabled:true}
  const plan=prepareVoiceReuse(document,JSON.stringify(stored),result)
  const schemaDocument=videoDocumentSchema.parse(plan.document)
  expect(plan.audioIdentity).toBe(videoAudioIdentity(schemaDocument))
  expect(plan.scriptSource).toBe(videoSpeechSource(schemaDocument))
 })

 it('mescla locução restaurada com o layout editado localmente depois do POST',()=>{
  const {document,result}=fixture(),plan=prepareVoiceReuse(document,result.audioIdentity,result)
  const current=structuredClone(document)
  current.layoutEdits={vertical:{intro:{seal:{x:44,y:31,scale:1.4,rotation:3}}}}
  const merged=mergeVoiceReuseDocument(document,current,plan.document)
  expect(merged.voiceApplied).toBe(true)
  expect(merged.document.layoutEdits).toEqual(current.layoutEdits)
  expect(merged.document.scripts).toEqual(plan.document.scripts)
  expect(merged.document.voice).toEqual(plan.document.voice)
  expect(merged.scriptSource).toBe(videoSpeechSource(plan.document))
  expect(videoAudioIdentityMatches(videoAudioIdentity(merged.document),merged.document)).toBe(true)
 })

 it('preserva roteiro e voz editados durante o POST e exige nova confirmação',()=>{
  const {document,result}=fixture(),plan=prepareVoiceReuse(document,result.audioIdentity,result)
  const current=structuredClone(document)
  current.scripts[1]!.text='Texto novo escrito durante a aplicação.'
  current.narrationText=current.scripts.map(script=>script.text).join('\n')
  current.voice.id='outra-voz'
  const merged=mergeVoiceReuseDocument(document,current,plan.document)
  expect(merged.voiceApplied).toBe(false)
  expect(merged.document.scripts).toEqual(current.scripts)
  expect(merged.document.voice).toEqual(current.voice)
  expect(merged.scriptSource).toBe('')
 })

 it('preserva quebras de linha internas no roteiro antigo sem criar narrationText inválido',()=>{
  const {document,result}=fixture(),stored=JSON.parse(result.audioIdentity)
  stored.scripts[0].text='Promoção.\nExtra.'
  const identity=JSON.stringify(stored),plan=prepareVoiceReuse(document,identity,{...result,audioIdentity:identity})
  expect(plan.document.scripts[0]?.text).toBe('Promoção.\nExtra.')
  expect(plan.document.narrationText).toBeUndefined()
  expect(videoNarrationText(plan.document)).toBe(plan.document.scripts.map(script=>script.text).join('\n'))
  expect(narrationScripts(plan.document,videoNarrationText(plan.document))).not.toEqual(plan.document.scripts)
  expect(validateVideoForGeneration(plan.document).filter(issue=>issue.includes('texto completo da locução'))).toEqual([])
  expect(videoAudioIdentityMatches(plan.audioIdentity,plan.document)).toBe(true)
 })
})
