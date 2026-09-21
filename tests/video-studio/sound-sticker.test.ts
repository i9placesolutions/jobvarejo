import {describe, expect, it} from 'vitest'
import {newVideoDocument} from '../../shared/video-studio/model'
import {musicGain, OPENING_SOUNDS, BOOM_OPENING_SOUNDS} from '../../shared/video-studio/sound-design'
import {fillStickerHoles} from '../../shared/video-studio/sticker-mask'
import {SOUND_EFFECTS} from '../../shared/video-studio/effect-catalog'

describe('Som e sticker do vídeo', () => {
  it('preserva o fundo externo e preenche apenas os vazios fechados do adesivo', () => {
    const mask = new Uint8ClampedArray(49)
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
      if (y === 1 || y === 5 || x === 1 || x === 5) mask[y * 7 + x] = 255
    }
    const filled = fillStickerHoles(mask, 7, 7)
    expect(filled[24]).toBe(255)
    expect(filled[0]).toBe(0)
    expect(filled[48]).toBe(0)
    expect(mask[24]).toBe(0)
    mask[3] = 0; mask[10] = 0
    expect(fillStickerHoles(mask, 7, 7)[24]).toBe(0)
  })

  it('mantém a música presente durante a voz e remove o ducking quando não há locução', () => {
    const doc = newVideoDocument(); doc.audio.musicVolume = .65
    const scenes = [{id: 'intro', from: 30, frames: 90, speechFrames: 45, audio: 'voice.mp3'}]
    expect(musicGain(50, 300, doc, scenes)).toBeCloseTo(.4225)
    expect(musicGain(100, 300, doc, scenes)).toBe(.65)
    expect(musicGain(25, 300, doc, scenes)).toBeGreaterThan(musicGain(29, 300, doc, scenes))
    expect(musicGain(82, 300, doc, scenes)).toBeGreaterThan(musicGain(76, 300, doc, scenes))
    doc.voice.enabled = false
    expect(musicGain(50, 300, doc, scenes)).toBe(.65)
    doc.voice.enabled = true; doc.audio.voiceVolume = 0
    expect(musicGain(50, 300, doc, scenes)).toBe(.65)
    expect(musicGain(300, 300, doc, scenes)).toBe(0)
  })

  it('começa os efeitos no frame zero e acompanha os ataques da logo e selo', () => {
    expect(OPENING_SOUNDS[0].frame).toBe(0)
    expect(OPENING_SOUNDS.some(s => s.frame === 4)).toBe(true)
    expect(OPENING_SOUNDS.some(s => s.frame === 8)).toBe(true)
    for (const cue of OPENING_SOUNDS) expect(SOUND_EFFECTS.some(s => s.id === cue.sound)).toBe(true)
  })
})

 it('abre espaço para a explosão sem baixar música quando os efeitos estão desligados',()=>{
  const doc=newVideoDocument();doc.theme='flyer-ab690e7b-f393-4416-b81c-e6ad3da654a4';doc.voice.enabled=false;doc.audio.musicVolume=.5;doc.audio.sounds=true;doc.audio.effectsVolume=.7;
  const scenes=[{id:'intro',from:0,frames:90}];
  expect(musicGain(8,300,doc,scenes)).toBeCloseTo(.125);
  expect(musicGain(60,300,doc,scenes)).toBe(.5);
  doc.audio.sounds=false;expect(musicGain(8,300,doc,scenes)).toBe(.5);
  expect(BOOM_OPENING_SOUNDS.find(c=>c.sound==='explosion-retail')?.frame).toBe(8);
 })
