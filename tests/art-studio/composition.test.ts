import { describe, it, expect } from 'vitest'
import { ART_STARTER_TEMPLATES } from '~/utils/art-studio/catalog'
import { artCompositionSchema } from '~/server/utils/art-studio-schema'
import {
  artImageCrop,
  cloneArt,
  personalizeArt,
  resizeArt
} from '~/utils/art-studio/composition'

describe('Estúdio de Artes — contrato independente', () => {
  it('todos os modelos iniciais são composições válidas com camadas únicas e logo dinâmica', () => {
    for (const template of ART_STARTER_TEMPLATES) {
      expect(
        artCompositionSchema.safeParse(template.composition).success,
        template.name
      ).toBe(true)
      expect(
        template.composition.layers.some(
          (l) => l.binding === 'logo' && l.src === ''
        )
      ).toBe(true)
    }
  })
  it('personalização não modifica o modelo nem mistura dados entre clientes', () => {
    const template = ART_STARTER_TEMPLATES[0]!.composition,
      original = JSON.stringify(template)
    const a = personalizeArt(template, {
      companyName: 'Loja A',
      logo: '/api/art-studio/brand-logo'
    })
    const b = personalizeArt(template, { companyName: 'Loja B' })
    expect(a.layers.find((l) => l.binding === 'companyName')?.text).toBe(
      'Loja A'
    )
    expect(b.layers.find((l) => l.binding === 'companyName')?.text).toBe(
      'Loja B'
    )
    expect(b.layers.find((l) => l.binding === 'logo')?.src).toBe('')
    expect(JSON.stringify(template)).toBe(original)
  })
  it('redimensiona sem perder vínculo, rotação, imagens ou posição proporcional', () => {
    const source = cloneArt(ART_STARTER_TEMPLATES[0]!.composition),
      result = resizeArt(source, 1080, 1920)
    expect(result.layers[0]!.y).toBeCloseTo((source.layers[0]!.y * 1920) / 1350)
    expect(result.layers.find((l) => l.binding === 'logo')?.binding).toBe(
      'logo'
    )
    expect(result.layers[2]!.rotation).toBe(source.layers[2]!.rotation)
    expect(source.height).toBe(1350)
  })
  it('mantém identidade da imagem em JSON após substituir, mover e salvar', () => {
    const doc = cloneArt(ART_STARTER_TEMPLATES[0]!.composition),
      logo = doc.layers.find((l) => l.binding === 'logo')!
    logo.src = '/api/art-studio/assets/11111111-1111-4111-8111-111111111111'
    logo.x = 125
    logo.y = 234
    const saved = artCompositionSchema.parse(JSON.parse(JSON.stringify(doc)))
    expect(saved.layers.find((l) => l.id === logo.id)).toEqual(logo)
  })
  it.each([
    'https://evil.test/a.png',
    'data:image/svg+xml,x',
    'blob:test',
    '/api/storage/proxy?key=private',
    '/api/art-studio/assets/../../other'
  ])('rejeita origem de imagem não autorizada: %s', (src) => {
    const doc = cloneArt(ART_STARTER_TEMPLATES[0]!.composition)
    doc.layers.find((l) => l.kind === 'image')!.src = src
    expect(artCompositionSchema.safeParse(doc).success).toBe(false)
  })
  it('aceita o endpoint autenticado da logo dinâmica', () => {
    const doc = personalizeArt(ART_STARTER_TEMPLATES[0]!.composition, {
      logo: '/api/art-studio/brand-logo'
    })
    expect(artCompositionSchema.safeParse(doc).success).toBe(true)
  })
  it('rejeita dimensões abusivas, IDs duplicados e fonte fora do catálogo', () => {
    const doc = cloneArt(ART_STARTER_TEMPLATES[0]!.composition)
    expect(
      artCompositionSchema.safeParse({ ...doc, width: 99999 }).success
    ).toBe(false)
    expect(
      artCompositionSchema.safeParse({
        ...doc,
        layers: [doc.layers[0], doc.layers[0]]
      }).success
    ).toBe(false)
    doc.layers[3]!.fontFamily = 'fonte inventada'
    expect(artCompositionSchema.safeParse(doc).success).toBe(false)
  })
  it('recorta sem distorcer e respeita os controles horizontal/vertical', () => {
    const layer = {
      ...ART_STARTER_TEMPLATES[0]!.composition.layers.at(-1)!,
      width: 200,
      height: 200,
      fit: 'cover' as const,
      cropX: 1
    }
    expect(artImageCrop(800, 400, layer)).toEqual({
      scale: 0.5,
      width: 400,
      height: 400,
      cropX: 400,
      cropY: 0
    })
    expect(artImageCrop(800, 400, { ...layer, fit: 'contain' })).toEqual({
      scale: 0.25,
      width: 800,
      height: 400,
      cropX: 0,
      cropY: 0
    })
  })
})

it('remoção de logo do cadastro esvazia somente o slot, preservando posição e tamanho', () => {
  const source = personalizeArt(ART_STARTER_TEMPLATES[0]!.composition, {
    logo: '/api/art-studio/brand-logo'
  })
  const original = source.layers.find((l) => l.binding === 'logo')!
  const output = personalizeArt(source, { logo: '' }),
    logo = output.layers.find((l) => l.binding === 'logo')!
  expect(logo.src).toBe('')
  expect([logo.x, logo.y, logo.width, logo.height]).toEqual([
    original.x,
    original.y,
    original.width,
    original.height
  ])
  expect(output.layers).toHaveLength(source.layers.length)
})
