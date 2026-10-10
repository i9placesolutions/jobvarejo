import overrides from './video-background-overrides.json'
import type {FlyerRecipe} from './flyer-recipes'
import type {VideoDocument} from './model'

interface VideoBackgroundOverride {
  name: string
  revision: number
  legacyBackground: string
  legacyContactColor?: string
  base: string
  backgroundVideo: string
  backgroundVideoDuration: number
  backgroundVideoHorizontal: string
  backgroundVideoHorizontalDuration: number
}

export const VIDEO_BACKGROUND_OVERRIDES = overrides as Record<string, VideoBackgroundOverride>

/** Fundos de encarte com cabeçalho/grade não são cenários de vídeo. */
export function withVideoBackground(recipe: FlyerRecipe): FlyerRecipe {
  const background = VIDEO_BACKGROUND_OVERRIDES[recipe.sourceProject]
  if (!background) return recipe
  return {
    ...recipe,
    revision: Math.max(recipe.revision || 1, background.revision),
    background: '',
    backgroundHorizontal: undefined,
    backgroundGradient: undefined,
    energyBackground: undefined,
    energyBackgroundVertical: undefined,
    base: background.base,
    backgroundVideo: background.backgroundVideo,
    backgroundVideoDuration: background.backgroundVideoDuration,
    backgroundVideoHorizontal: background.backgroundVideoHorizontal,
    backgroundVideoHorizontalDuration: background.backgroundVideoHorizontalDuration,
    appearanceDefaults: {...recipe.appearanceDefaults, contactColor: '#ffffff'},
  }
}

/** Atualiza apenas a cor padrão antiga ao reproduzir documentos já salvos. */
export function videoBackgroundDocument(document: VideoDocument): VideoDocument {
  const background = VIDEO_BACKGROUND_OVERRIDES[document.theme.replace(/^flyer-/, '')]
  if (!background || document.background || (document.templateRevision || 1) >= background.revision
    || !background.legacyContactColor || document.appearance?.contactColor?.toLowerCase() !== background.legacyContactColor.toLowerCase()) return document
  return {...document, appearance: {...document.appearance, contactColor: '#ffffff'}}
}
