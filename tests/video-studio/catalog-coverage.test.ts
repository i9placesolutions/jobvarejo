import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {describe,it,expect} from 'vitest'
import {VIDEO_BACKGROUNDS,backgroundAsset} from '../../shared/video-studio/backgrounds'
import {newVideoFromTemplate,applyVideoTemplate} from '../../shared/video-studio/templates'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
import {isBuiltinMusic,ATMOSPHERE_EFFECTS} from '../../shared/video-studio/effect-catalog'
describe('Cobertura do catálogo de encartes',()=>{
 const recipes=Object.values(FLYER_RECIPES)
 it('identifica cada encarte por ID e mantém uma trilha própria por modelo',()=>{
  expect(recipes.length).toBeGreaterThanOrEqual(103)
  expect(recipes.some(r=>r.sourceProject==='d6e5df76-0d63-41fa-8cbd-edd5bf29a259')).toBe(true)
  expect(new Set(recipes.map(r=>r.sourceProject)).size).toBe(recipes.length)
  expect(new Set(recipes.map(r=>r.music)).size).toBe(recipes.length)
  const hashes=recipes.map(r=>{expect(isBuiltinMusic(r.music)).toBe(true);return createHash('sha256').update(readFileSync(`public/video-studio/audio/${r.music}.mp3`)).digest('hex')})
  expect(new Set(hashes).size).toBe(recipes.length)
 })
 it('não deixa referências de arte quebradas e preserva os fundos vetoriais',()=>{
  for(const r of recipes){expect(Boolean(r.seal||r.nativeTitle)).toBe(true);expect(Boolean(r.background||r.backgroundGradient)).toBe(true)
   for(const a of [r.background,r.seal,r.energyBackground,r.energyBackgroundVertical].filter(Boolean))expect(existsSync(`public/video-studio/templates/${a}`)).toBe(true)
  }
 })
 it('preserva a paleta do encarte em todos os modelos sem sobreposição genérica',()=>{
  for(const r of recipes){expect(r.energyBackground).toBeUndefined();expect(r.energyBackgroundVertical).toBeUndefined()}
  const client=recipes.find(r=>r.sourceProject==='ea0d0789-3081-409c-b830-10739806b065')!
  const rgb=client.base.match(/[a-f0-9]{2}/gi)!.map(v=>parseInt(v,16))
  expect(rgb[2]).toBeGreaterThan(rgb[0]!+80)
  expect(client.background).toContain(client.sourceProject)
 })
 it('oferece seis fundos com arte própria em cada formato e mantém a escolha do usuário',()=>{
  for(const bg of VIDEO_BACKGROUNDS){
   for(const format of ['vertical','horizontal'] as const)expect(existsSync('public/video-studio/templates/'+backgroundAsset(bg.id,format))).toBe(true)
   const doc=newVideoFromTemplate('alerta');doc.background=bg.id;applyVideoTemplate(doc,'saldao');expect(doc.background).toBe(bg.id);expect(doc.templateRevision).toBe(19);expect(videoDocumentSchema.safeParse(doc).success).toBe(true)
  }
  expect(videoDocumentSchema.safeParse({...newVideoFromTemplate('alerta'),background:'https://outra-origem'}).success).toBe(false)
 })
 it('distribui atmosferas diferentes e oferece todos os novos efeitos reutilizáveis',()=>{
  expect(new Set(recipes.map(r=>r.backgroundKind)).size).toBeGreaterThanOrEqual(10)
  const ids=ATMOSPHERE_EFFECTS.map(e=>e.id)
  for(const r of recipes)for(const fx of r.motion.atmosphere)expect(ids).toContain(fx)
  for(const fx of ['fire','fire-jets','embers','smoke-plumes','spark-burst','laser-sweep','bokeh','ribbons'])expect(recipes.some(r=>r.motion.atmosphere.includes(fx as any))).toBe(true)
 })
})
