import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'
import supplemental from '../../shared/video-studio/supplemental-audio.json'
import backgrounds from '../../shared/video-studio/supplemental-backgrounds.json'
import {VIDEO_BACKGROUNDS,backgroundAsset} from '../../shared/video-studio/backgrounds'
import {ATMOSPHERE_EFFECTS,DEFAULT_MOTION,isBuiltinMusic,SOUND_EFFECTS} from '../../shared/video-studio/effect-catalog'
import {newVideoDocument} from '../../shared/video-studio/model'
import {videoDocumentSchema} from '../../server/utils/video-studio/schema'
// O seletor real do worker determina quais sprites entram no MP4.
import {selectCatalogTemplateAssets} from '../../workers/video-studio/catalog-assets.mjs'

const manifest=JSON.parse(readFileSync('shared/video-studio/catalog-assets.json','utf8'))
const provenance=JSON.parse(readFileSync('public/video-studio/catalog-provenance.json','utf8'))

describe('expansão CC0 do catálogo de vídeo',()=>{
 it('registra arquivos distintos com origem, licença e integridade por asset',()=>{
  expect(provenance.assets).toHaveLength(131)
  const paths=new Set<string>(),hashes=new Set<string>()
  for(const asset of provenance.assets){
   expect(asset.license).toBe('CC0-1.0')
   expect(asset.source).toMatch(/^https:\/\/(kenney.nl|opengameart.org)\//)
   expect(asset.author).toBeTruthy()
   expect(asset.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
   expect(manifest.assets[asset.path]?.sha256).toBe(asset.sha256)
   expect(manifest.assets[asset.path]?.bytes).toBeGreaterThan(44)
   paths.add(asset.path);hashes.add(asset.sha256)
  }
  expect(paths.size).toBe(131);expect(hashes.size).toBe(131)
 })
 it('aceita os novos fundos nos dois formatos e no contrato persistido',()=>{
  expect(backgrounds).toHaveLength(24)
  for(const bg of backgrounds){
   expect(VIDEO_BACKGROUNDS.some(item=>item.id===bg.id)).toBe(true)
   expect(videoDocumentSchema.safeParse({...newVideoDocument(),background:bg.id}).success).toBe(true)
   for(const format of ['vertical','horizontal'] as const){
    const path='templates/'+backgroundAsset(bg.id,format)
    expect(selectCatalogTemplateAssets({background:bg.id},format,{backgroundAsset})).toContain(path)
    expect(manifest.assets[path].contentType).toBe('image/png')
   }
  }
 })
 it('oferece as músicas e sons baixados e preserva a validação de sons desconhecidos',()=>{
  expect(supplemental.music).toHaveLength(34);expect(supplemental.sounds).toHaveLength(40)
  for(const track of supplemental.music){expect(isBuiltinMusic(track.id)).toBe(true);expect(manifest.assets[`audio/${track.id}.mp3`].contentType).toBe('audio/mpeg')}
  for(const sound of supplemental.sounds){
   expect(SOUND_EFFECTS.some(item=>item.id===sound.id)).toBe(true)
   expect(videoDocumentSchema.safeParse({...newVideoDocument(),motion:{...DEFAULT_MOTION,transitionSound:sound.id,accentSound:sound.id}}).success).toBe(true)
   const asset=provenance.assets.find((item:any)=>item.id===sound.id)
   expect(asset.channels).toBe(2);expect(asset.sampleRate).toBe(48000);expect(asset.seconds).toBeGreaterThan(0)
  }
  expect(videoDocumentSchema.safeParse({...newVideoDocument(),motion:{...DEFAULT_MOTION,transitionSound:'unknown-external'}}).success).toBe(false)
 })
 it('copia somente os sprites escolhidos para o render final',()=>{
  const sprites=ATMOSPHERE_EFFECTS.filter(effect=>effect.id.startsWith('sprite-'))
  expect(sprites).toHaveLength(9)
  for(const effect of sprites){
   const doc={...newVideoDocument(),motion:{...DEFAULT_MOTION,atmosphere:[effect.id]}}
   const selected=selectCatalogTemplateAssets(doc,'vertical').filter((path:string)=>path.includes('/effects/'))
   expect(selected).toHaveLength(1);expect(manifest.assets[selected[0]]).toBeTruthy()
  }
  expect(selectCatalogTemplateAssets(newVideoDocument(),'horizontal').some((path:string)=>path.includes('/effects/'))).toBe(false)
 })
})
