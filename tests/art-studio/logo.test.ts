import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  trimArtTransparency,
  prepareArtLogo
} from '~/server/utils/art-studio-logo'
import { artLayerImageSrc } from '~/utils/art-studio/logo'
import { ART_STARTER_TEMPLATES } from '~/utils/art-studio/catalog'
describe('Logo do estúdio — contrato das ofertas', () => {
  it('auto trim remove margens transparentes sem cortar conteúdo opaco preto', async () => {
    const logo = await sharp({
      create: { width: 40, height: 30, channels: 4, background: '#000000' }
    })
      .png()
      .toBuffer()
    const padded = await sharp(logo)
      .extend({
        top: 20,
        bottom: 10,
        left: 30,
        right: 15,
        background: '#00000000'
      })
      .png()
      .toBuffer()
    const trimmed = await trimArtTransparency(padded),
      meta = await sharp(trimmed).metadata()
    expect([meta.width, meta.height]).toEqual([40, 30])
    const pixels = await sharp(trimmed).raw().toBuffer()
    expect([...pixels.subarray(0, 4)]).toEqual([0, 0, 0, 255])
  })
  it.each(['#000000', '#ffffff'])(
    'preserva fundo opaco %s sem presumir que seja margem',
    async (background) => {
      const source = await sharp({
        create: { width: 80, height: 60, channels: 4, background }
      })
        .png()
        .toBuffer()
      const meta = await sharp(await trimArtTransparency(source)).metadata()
      expect([meta.width, meta.height]).toEqual([80, 60])
    }
  )
  it('não perde o slot da imagem inteiramente transparente', async () => {
    const source = await sharp({
      create: { width: 80, height: 60, channels: 4, background: '#00000000' }
    })
      .png()
      .toBuffer()
    const meta = await sharp(await trimArtTransparency(source)).metadata()
    expect([meta.width, meta.height]).toEqual([80, 60])
  })
  it('renderer mantém tamanho do slot com trim, container e contorno', async () => {
    const image = await sharp({
      create: { width: 60, height: 25, channels: 4, background: '#00ff00' }
    })
      .extend({
        top: 40,
        bottom: 40,
        left: 40,
        right: 40,
        background: '#00000000'
      })
      .png()
      .toBuffer()
    for (const backdrop of ['none', 'square', 'round', 'oval']) {
      const output = await prepareArtLogo(image, {
        width: 205,
        height: 140,
        trim: true,
        backdrop,
        padding: 12,
        outline: true,
        outlineColor: '#ffffff',
        outlineWidth: 4
      })
      const meta = await sharp(output).metadata()
      expect([meta.width, meta.height]).toEqual([205, 140])
    }
  })
  it('URL do preview reflete configurações sem alterar a referência salva', () => {
    const layer = {
      ...ART_STARTER_TEMPLATES[0]!.composition.layers.at(-1)!,
      src: '/api/art-studio/brand-logo',
      autoTrim: true
    }
    expect(artLayerImageSrc(layer)).toContain('source=brand')
    expect(artLayerImageSrc(layer)).toContain('trim=true')
    expect(layer.src).toBe('/api/art-studio/brand-logo')
    expect(artLayerImageSrc({ ...layer, autoTrim: false })).toContain(
      'trim=false'
    )
  })
})

it('contorno forma base contínua sem listras e acompanha a silhueta', async () => {
  const source = await sharp({create:{width:20,height:20,channels:4,background:'#ff0000'}}).png().toBuffer()
  const output = await prepareArtLogo(source,{width:60,height:60,trim:true,backdrop:'none',padding:20,outline:true,outlineColor:'#ffffff',outlineWidth:4})
  const {data,info} = await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const pixel=(x:number,y:number)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)]
  for(let y=12;y<48;y++) expect(pixel(30,y)[3]).toBe(255)
  expect(pixel(30,12)).toEqual([255,255,255,255])
  expect(pixel(30,30)).toEqual([255,0,0,255])
  expect(pixel(3,3)[3]).toBe(0)
})
