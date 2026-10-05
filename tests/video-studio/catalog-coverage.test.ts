import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import {VIDEO_BACKGROUNDS,backgroundAsset} from '../../shared/video-studio/backgrounds'
import {newVideoFromTemplate,applyVideoTemplate} from '../../shared/video-studio/templates'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
import {isBuiltinMusic,ATMOSPHERE_EFFECTS} from '../../shared/video-studio/effect-catalog'
const catalog=JSON.parse(readFileSync('shared/video-studio/catalog-assets.json','utf8'))
const hasCatalogAsset=(path:string)=>{
 const asset=catalog.assets[path]
 return Boolean(asset&&/^[a-f0-9]{64}$/.test(asset.sha256)&&Number.isSafeInteger(asset.bytes)&&asset.bytes>=0&&asset.contentType&&asset.key===`video-studio/catalog/${asset.sha256}/${path}`)
}
describe('Cobertura do catálogo de encartes',()=>{
 const recipes=Object.values(FLYER_RECIPES)
 it('identifica cada encarte e mantém trilhas UUID próprias e mídias de áudio válidas',()=>{
  expect(recipes.length).toBeGreaterThanOrEqual(103)
  expect(recipes.some(r=>r.sourceProject==='d6e5df76-0d63-41fa-8cbd-edd5bf29a259')).toBe(true)
  expect(new Set(recipes.map(r=>r.sourceProject)).size).toBe(recipes.length)
  const modelTracks=recipes.filter(r=>r.music.startsWith('model-')),reference=recipes.filter(r=>r.referenceArtwork)
  expect(new Set(modelTracks.map(r=>r.music)).size).toBe(modelTracks.length)
  const hashes=recipes.map(r=>{expect(isBuiltinMusic(r.music)).toBe(true);const path=`audio/${r.music}.mp3`;expect(hasCatalogAsset(path)).toBe(true);return catalog.assets[path].sha256})
  const modelHashes=modelTracks.map(r=>catalog.assets[`audio/${r.music}.mp3`].sha256)
  expect(new Set(modelHashes).size).toBe(modelTracks.length)
  expect(new Set(reference.map(r=>r.music)).size).toBeGreaterThan(1)
  expect(new Set(reference.map(r=>catalog.assets[`audio/${r.music}.mp3`].sha256)).size).toBeGreaterThan(1)
 })
 it('não deixa referências de arte quebradas e preserva os fundos vetoriais',()=>{
  for(const r of recipes){expect(Boolean(r.seal||r.nativeTitle||r.referenceArtwork)).toBe(true)
   const explicitBackground=Boolean(r.background||r.backgroundGradient)
   const animatedPaletteBackground=Boolean(r.referenceArtwork&&/^#[0-9a-f]{6}$/i.test(r.base)&&r.backgroundKind&&r.motion.atmosphere.length)
   expect(explicitBackground||animatedPaletteBackground).toBe(true)
   for(const a of [r.background,r.seal,r.energyBackground,r.energyBackgroundVertical].filter(Boolean))expect(hasCatalogAsset(`templates/${a}`)).toBe(true)
   if(r.referenceArtwork)expect(hasCatalogAsset(r.referenceArtwork.src.replace('/video-studio/',''))).toBe(true)
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
   for(const format of ['vertical','horizontal'] as const)expect(hasCatalogAsset('templates/'+backgroundAsset(bg.id,format))).toBe(true)
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
