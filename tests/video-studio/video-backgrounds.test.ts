import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import {FLYER_RECIPES} from '../../shared/video-studio/flyer-recipes'
import {newVideoFromTemplate} from '../../shared/video-studio/templates'
import {VIDEO_BACKGROUND_OVERRIDES, videoBackgroundDocument, withVideoBackground} from '../../shared/video-studio/video-backgrounds'
import {backgroundAsset} from '../../shared/video-studio/backgrounds'
import {selectCatalogTemplateAssets} from '../../workers/video-studio/catalog-assets.mjs'

const catalog = JSON.parse(readFileSync('shared/video-studio/catalog-assets.json', 'utf8')).assets
const sourceRecipes = JSON.parse(readFileSync('shared/video-studio/generated-flyer-recipes.json', 'utf8'))

describe('Cenários de vídeo independentes dos encartes', () => {
  it('usa clipes nos dois formatos para todos os modelos com área de encarte', () => {
    expect(Object.keys(VIDEO_BACKGROUND_OVERRIDES)).toHaveLength(22)
    for (const [sourceProject, correction] of Object.entries(VIDEO_BACKGROUND_OVERRIDES)) {
      const recipe = Object.values(FLYER_RECIPES).find(r => r.sourceProject === sourceProject)!
      expect(recipe, correction.name).toBeDefined()
      // Cartazes também leem este catálogo: a arte original deve continuar intacta.
      expect(sourceRecipes.find((r: {sourceProject: string}) => r.sourceProject === sourceProject).background).toBe(correction.legacyBackground)
      expect(recipe.background).toBe('')
      expect(recipe.backgroundHorizontal).toBeUndefined()
      const document = newVideoFromTemplate(recipe.id)
      for (const format of ['vertical', 'horizontal'] as const) {
        const asset = format === 'vertical' ? recipe.backgroundVideo : recipe.backgroundVideoHorizontal
        expect(asset).toBeTruthy()
        expect(catalog[`templates/${asset}`]?.contentType).toBe('video/mp4')
        const assets = selectCatalogTemplateAssets(document, format, {recipe, backgroundAsset})
        expect(assets).toContain(`templates/${asset}`)
        expect(assets).not.toContain(`templates/${correction.legacyBackground}`)
      }
      expect(recipe.backgroundVideo).not.toBe(recipe.backgroundVideoHorizontal)
      expect(withVideoBackground(recipe)).toEqual(recipe)
    }
  })

  it('mantém fundos escolhidos pelo usuário e modelos que já têm cenário próprio', () => {
    const recipe = FLYER_RECIPES['flyer-454cb8bf-ec09-45d9-8676-414ec93bc0db']!
    const document = newVideoFromTemplate(recipe.id)
    document.background = 'harvest'
    const assets = selectCatalogTemplateAssets(document, 'horizontal', {recipe, backgroundAsset})
    expect(assets).toContain('templates/backgrounds/harvest-v1.png')
    expect(assets).not.toContain(`templates/${recipe.backgroundVideoHorizontal}`)
    const unchanged = FLYER_RECIPES['flyer-e69be142-fce7-4c83-8775-66e03030c071']!
    expect(withVideoBackground(unchanged)).toBe(unchanged)
    expect(unchanged.backgroundVideo).toBe('torra-tudo-fire-v1.mp4')
  })

  it('adapta o contraste padrão de documentos antigos sem sobrescrever a personalização', () => {
    const document = newVideoFromTemplate('flyer-454cb8bf-ec09-45d9-8676-414ec93bc0db')
    expect(document.appearance?.contactColor).toBe('#ffffff')
    document.templateRevision = 19
    document.appearance = {contactColor: '#032e78', priceColor: '#123456'}
    const corrected = videoBackgroundDocument(document)
    expect(corrected.appearance).toEqual({contactColor: '#ffffff', priceColor: '#123456'})
    expect(document.appearance.contactColor).toBe('#032e78')
    document.appearance.contactColor = '#ffbb11'
    expect(videoBackgroundDocument(document)).toBe(document)
    document.appearance.contactColor = '#032e78'
    document.background = 'harvest'
    expect(videoBackgroundDocument(document)).toBe(document)
    document.background = undefined
    document.templateRevision = FLYER_RECIPES[document.theme]!.revision
    expect(videoBackgroundDocument(document)).toBe(document)
  })
})
