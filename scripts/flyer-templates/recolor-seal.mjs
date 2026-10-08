// Recolore (selos de encarte que destoam da paleta do modelo). Recolore só uma faixa de matiz do selo (ex.: azul → vermelho), mantendo dourado, branco e sombras.
// Uso: node recolor.mjs <entrada.png> <saída.png> <matizDe> <largura> <matizPara> [fatorLuz=1]
import sharp from 'sharp'
const [input, output, from, width, to, light = '1'] = process.argv.slice(2)
const [hFrom, hW, hTo, kL] = [from, width, to, light].map(Number)
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const hsl = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return [h, s, l] }
const rgb = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [r + m, g + m, b + m] }
for (let i = 0; i < data.length; i += 4) {
  if (!data[i + 3]) continue
  const [h, s, l] = hsl(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255)
  const dist = Math.abs(((h - hFrom + 540) % 360) - 180)
  const w = Math.min(1, Math.max(0, (hW - dist) / 10)) * Math.min(1, Math.max(0, (s - .12) / .1))
  if (!w) continue
  const [r, g, b] = rgb((hTo + (h - hFrom) + 360) % 360, s, Math.min(1, l * kL))
  data[i] = Math.round(data[i] * (1 - w) + r * 255 * w); data[i + 1] = Math.round(data[i + 1] * (1 - w) + g * 255 * w); data[i + 2] = Math.round(data[i + 2] * (1 - w) + b * 255 * w)
}
await sharp(data, { raw: info }).png().toFile(output)
console.log('ok', output)
