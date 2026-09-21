import type {VideoDocument, VideoScene} from './model'

// Os ataques acompanham logo (frame 4), selo (8) e brilho da abertura (20).
export const OPENING_SOUNDS = [
  {sound: 'air-swipe', frame: 0, gain: .85},
  {sound: 'snap', frame: 4, gain: .5},
  {sound: 'boom', frame: 8, gain: .85},
  {sound: 'metal-hit', frame: 9, gain: .45},
  {sound: 'sparkle', frame: 20, gain: .6},
] as const

export function musicGain(frame: number, duration: number, doc: VideoDocument, scenes: VideoScene[]) {
  let duck = 0
  if (doc.voice.enabled && doc.audio.voiceVolume > 0) for (const scene of scenes) {
    if (!scene.audio) continue
    const end = scene.from + (scene.speechFrames ?? scene.frames)
    const attack = Math.min(1, Math.max(0, (frame - scene.from + 6) / 6))
    const release = Math.min(1, Math.max(0, (end + 12 - frame) / 12))
    duck = Math.max(duck, Math.min(attack, release))
  }
  const fade = Math.max(0, Math.min(1, (frame + 1) / 5, (duration - frame) / 18))
  return doc.audio.musicVolume * (1 - duck * .35) * fade
}
