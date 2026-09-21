// Curvas compartilhadas entre a prévia e o render, sem relógio ou aleatoriedade.
const clamp = (n: number) => Math.min(1, Math.max(0, n))
export function retailEntrance(frame: number, delay = 0, overshoot = .035) {
  const f = frame - delay
  const rise = clamp(f / 4)
  const settle = clamp((f - 4) / 8)
  const scale = f <= 4
    ? .58 + (1 + overshoot - .58) * (1 - Math.pow(1 - rise, 3))
    : 1 + overshoot * Math.pow(1 - settle, 3)
  return {scale, opacity: clamp(f / 2), travel: Math.pow(1 - rise, 3)}
}

export function retailExit(frame: number, duration: number) {
  const t = clamp((frame - duration + 5) / 5)
  return {opacity: 1 - t * t, scale: 1 - .12 * t * t, blur: t * 3}
}

// Impulsos curtos e amortecidos; a imagem volta exatamente ao repouso para leitura.
export function retailImpact(frame: number, strength = 1) {
  if (frame < 0 || frame >= 18) return {x: 0, y: 0, rotation: 0, zoom: 0}
  const envelope = Math.pow(1 - frame / 18, 1.6) * strength
  return {
    x: Math.sin(frame * 1.65) * 38 * envelope,
    y: Math.cos(frame * 2.1) * 24 * envelope,
    rotation: Math.sin(frame * 1.3) * 1.45 * envelope,
    zoom: .04 * envelope,
  }
}

export function retailTransition(frame: number, mode: 'light' | 'slide' | 'smoke' | 'fade') {
  if (frame < -5 || frame > 9) return {energy: 0, flash: 0, zoom: 0, x: 0, blur: 0}
  const energy = frame < 0 ? Math.pow((frame + 5) / 5, 2) : Math.pow(1 - frame / 9, 3)
  const flash = mode === 'light' ? Math.max(0, 1 - Math.abs(frame) / 3) * .55 : 0
  return {energy, flash, zoom: energy * (mode === 'fade' ? 0 : .07), x: mode === 'slide' ? Math.sin(frame * .7) * energy * 55 : 0, blur: energy * (mode === 'slide' ? 12 : mode === 'smoke' ? 7 : 0)}
}
