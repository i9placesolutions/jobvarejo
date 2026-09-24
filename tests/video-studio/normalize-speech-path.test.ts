import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { normalizeVideoSpeech, videoSpeechNormalizerPath } from '../../server/utils/video-studio/normalize-speech'

describe('video speech normalizer location', () => {
  it('finds the script from the project root and Nuxt preview working directory', () => {
    const root = process.cwd()
    const script = resolve(root, 'workers/video-studio/normalize.py')
    expect(videoSpeechNormalizerPath(root)).toBe(script)
    expect(videoSpeechNormalizerPath(resolve(root, '.output'))).toBe(script)
    expect(videoSpeechNormalizerPath(resolve(root, '.output/server'))).toBe(script)
  })
  it('prepares speech while the API runs from .output', async () => {
    const root = process.cwd()
    try {
      process.chdir(resolve(root, '.output'))
      const scripts = await normalizeVideoSpeech([
        { id: 'intro', text: 'Ofertas até 24/09/2026' },
        { id: 'offer', text: 'Arroz 5kg por R$ 19,90' }
      ], [])
      expect(scripts[0]?.text).toContain('setembro')
      expect(scripts[1]?.text).toContain('dezenove reais e noventa centavos')
    } finally {
      process.chdir(root)
    }
  })
})
