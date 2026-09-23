import {flyerRecipe} from './flyer-recipes'
import {newVideoDocument, VIDEO_THEMES, type VideoDocument} from './model'
import {MOTION_PRESETS} from './effect-catalog'

// O catálogo compartilha somente o estilo. Dados e mídias pertencem ao novo projeto.
export function applyVideoTemplate(doc: VideoDocument, id: VideoDocument['theme']) {
  const template = VIDEO_THEMES.find(t => t.id === id)!
  doc.theme = id
  doc.campaign = template.title
  const recipe=flyerRecipe(id)
  if(recipe?.preferSingleProduct) doc.duplicateProducts=false
  if(recipe){doc.templateRevision=recipe.revision||1;doc.layoutVersion=2;doc.intensity=.85;doc.effects=['shake','zoom','glow','rays','pulse'];doc.transition=recipe.transition;doc.motion=structuredClone(recipe.motion);doc.priceLabel='';doc.audio.music=recipe.music;return}
  doc.effects = id === 'grill' ? ['smoke','embers','fire','zoom']
    : id === 'party' ? ['confetti','glow','bounce']
    : id === 'fresh' ? ['glow','rays','zoom']
    : ['shake','zoom','smoke','embers','glow','rays','pulse']
  if (id === 'impact') {
    const preset = MOTION_PRESETS.find(p => p.id === 'pressure')!
    doc.layoutVersion = 2
    doc.intensity = .85
    doc.transition = preset.transition
    doc.motion = structuredClone(preset.motion)
  }
}

export function newVideoFromTemplate(id: VideoDocument['theme'] = 'impact'): VideoDocument {
  const doc = newVideoDocument()
  applyVideoTemplate(doc, id)
  doc.voice.enabled = false
  doc.audio = {music:flyerRecipe(id)?.music||'retail-drive',musicVolume:.36,voiceVolume:1,effectsVolume:.45,sounds:true}
  return doc
}
