import React, {useEffect, useState} from 'react'
import {Img, cancelRender, continueRender, delayRender} from 'remotion'
import {fillStickerHoles} from './sticker-mask'

function canvas(width: number, height: number) {
  const element = document.createElement('canvas')
  element.width = width; element.height = height
  return element
}

// Derivado apenas para o vídeo. A marca cadastrada e seus pixels de cor são preservados.
export async function makeStickerLogo(src: string): Promise<string> {
  const image = new Image()
  image.crossOrigin = 'anonymous'; image.src = src
  await image.decode()
  const scale = Math.min(3, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
  const w = Math.round(image.naturalWidth * scale), h = Math.round(image.naturalHeight * scale)
  const radius = Math.max(3, Math.round(Math.max(w, h) * .012))
  const pad = radius * 3, width = w + pad * 2, height = h + pad * 2
  const source = canvas(width, height), ctx = source.getContext('2d')!
  ctx.drawImage(image, pad, pad, w, h)
  const pixels = ctx.getImageData(0, 0, width, height)
  // Resíduos quase transparentes do recorte não podem virar manchas brancas.
  for (let i = 3; i < pixels.data.length; i += 4) if (pixels.data[i]! < 24) pixels.data[i] = 0
  ctx.putImageData(pixels, 0, 0)
  const mask = canvas(width, height), mc = mask.getContext('2d')!
  const solid = new ImageData(width, height)
  for (let i = 3; i < pixels.data.length; i += 4) solid.data[i] = pixels.data[i]! >= 100 ? 255 : 0
  mc.putImageData(solid, 0, 0)
  const backing = canvas(width, height), bc = backing.getContext('2d')!
  // Expansão circular: sem cantos quadrados da morfologia SVG.
  for (let i = 0; i < 40; i++) {
    const angle = i * Math.PI * 2 / 40
    bc.drawImage(mask, Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  bc.drawImage(mask, 0, 0)
  const expanded = bc.getImageData(0, 0, width, height)
  const filled = fillStickerHoles(Uint8ClampedArray.from({length: width * height}, (_, i) => expanded.data[i * 4 + 3]!), width, height)
  for (let i = 0; i < filled.length; i++) {
    expanded.data[i * 4] = expanded.data[i * 4 + 1] = expanded.data[i * 4 + 2] = 255
    expanded.data[i * 4 + 3] = filled[i]!
  }
  bc.putImageData(expanded, 0, 0)
  const output = canvas(width, height), oc = output.getContext('2d')!
  oc.filter = 'blur(1px)'; oc.drawImage(backing, 0, 0); oc.filter = 'none'
  oc.drawImage(source, 0, 0)
  return output.toDataURL('image/png')
}

export function StickerLogo({src, style}: {src: string; style: React.CSSProperties}) {
  const [ready, setReady] = useState<{src: string; image: string} | null>(null)
  const [handle] = useState(() => delayRender('Preparando o contorno da logo'))
  useEffect(() => {
    let active = true
    const next = delayRender('Atualizando o contorno da logo')
    makeStickerLogo(src).then(image => {
      if (active) setReady({src, image})
      continueRender(handle); continueRender(next)
    }).catch(error => { continueRender(handle); continueRender(next); if (active) cancelRender(error) })
    return () => { active = false; continueRender(next); continueRender(handle) }
  }, [src, handle])
  return ready?.src === src ? React.createElement(Img, {src: ready.image, style}) : null
}
