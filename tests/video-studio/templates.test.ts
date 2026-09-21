import {describe,it,expect} from 'vitest'
import {newVideoFromTemplate,applyVideoTemplate} from '../../shared/video-studio/templates'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'

describe('Modelos reutilizáveis de vídeo',()=>{
 it('começa sem marca, ofertas, data fictícia ou locução de outra conta',()=>{
  const doc=newVideoFromTemplate()
  expect(doc.brand.logo).toBe('');expect(doc.brand.name).toBe('')
  expect(doc.offers).toEqual([]);expect(doc.scripts).toEqual([]);expect(doc.validity).toBe('')
  expect(doc.voice.enabled).toBe(false);expect(doc.voice.id).toBe('default')
  expect(doc.motion?.product).toBe('slam');expect(doc.transition).toBe('snap-zoom')
  expect(videoDocumentSchema.safeParse(doc).success).toBe(true)
 })
 it('mantém instâncias independentes e preserva os dados do usuário ao trocar estilo',()=>{
  const a=newVideoFromTemplate(),b=newVideoFromTemplate()
  a.brand.name='Loja A';a.motion!.atmosphere.push('grid');a.voice={enabled:true,id:'voz-da-conta',pronunciations:[]}
  expect(b.brand.name).toBe('');expect(b.motion!.atmosphere).not.toContain('grid')
  applyVideoTemplate(a,'impact')
  expect(a.brand.name).toBe('Loja A');expect(a.voice.id).toBe('voz-da-conta');expect(a.voice.enabled).toBe(true)
 })
})
