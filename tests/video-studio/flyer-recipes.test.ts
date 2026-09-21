import {resolveVideoLabel,type VideoLabel} from '../../shared/video-studio/labels'
import {describe,it,expect} from 'vitest'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
import {newVideoFromTemplate,applyVideoTemplate} from '../../shared/video-studio/templates'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {VIDEO_FORMATS,buildVideoTimeline} from '../../shared/video-studio/model'
describe('Encartes em vídeo',()=>{
 for(const r of Object.values(FLYER_RECIPES))it(r.name+' mantém conteúdo independente e áreas dentro dos formatos',()=>{
  const doc=newVideoFromTemplate(r.id)
  expect(videoDocumentSchema.safeParse(doc).success).toBe(true)
  expect(doc.voice.enabled).toBe(false);expect(doc.brand.logo).toBe('');expect(doc.offers).toEqual([])
  for(const format of ['vertical','horizontal'] as const)for(const [x,y,w,h] of Object.values(r[format])){
   expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0)
   expect(x+w).toBeLessThanOrEqual(VIDEO_FORMATS[format].width);expect(y+h).toBeLessThanOrEqual(VIDEO_FORMATS[format].height)
  }
  for(const format of ['vertical','horizontal'] as const){
   const layout=r[format],a=layout.name
   for(const key of ['product','seal','logo','price'] as const){
    const b=layout[key]
    const intersects=a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1]
    expect(intersects,`${r.name} ${format}: nome separado de ${key}`).toBe(false)
   }
  }
  // Reserva real após o zoom contínuo de 4,5% usado pela composição.
  for(const key of ['seal','logo'] as const){const [x,y,w,h]=r.vertical[key];expect((y-960)*1.045+960,`${r.name}: topo seguro de ${key}`).toBeGreaterThan(12);expect((y+h-960)*1.045+960,`${r.name}: base segura de ${key}`).toBeLessThan(1920)}
  const before=structuredClone(r.motion);doc.motion!.atmosphere.push('dust');expect(r.motion).toEqual(before)
  doc.brand.name='Minha loja';doc.validity='20 A 27/09/2026';doc.voice.id='voz-pessoal';applyVideoTemplate(doc,r.id)
  expect(doc.brand.name).toBe('Minha loja');expect(doc.validity).toBe('20 A 27/09/2026');expect(doc.voice.id).toBe('voz-pessoal')
  expect(buildVideoTimeline(doc).at(-1)!.from+buildVideoTimeline(doc).at(-1)!.frames).toBeLessThanOrEqual(900)
 })
 it('resolve etiquetas somente no catálogo da conta e respeita escolha explícita',()=>{
  const labels=[{id:'da-conta',name:'PRETA VERMELHA AMARELA'},{id:'tpl_default',name:'Padrão'}] as VideoLabel[]
  expect(resolveVideoLabel(labels,'alerta')?.id).toBe('da-conta')
  expect(resolveVideoLabel(labels,'alerta','tpl_default')?.id).toBe('tpl_default')
  expect(resolveVideoLabel(labels,'alerta','outra-conta')).toBeUndefined()
  expect(resolveVideoLabel([],'alerta')).toBeUndefined()
 })
 it('não aceita identificação de modelo fora do catálogo',()=>expect(videoDocumentSchema.safeParse({...newVideoFromTemplate(),theme:'qualquer-url'}).success).toBe(false))
})
