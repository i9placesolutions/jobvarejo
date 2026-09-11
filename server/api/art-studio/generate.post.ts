import { z } from 'zod'
import { artUser } from '~/server/utils/art-studio'
import {
  parseArtInput,
  artCompositionSchema
} from '~/server/utils/art-studio-schema'
import { ART_STARTER_TEMPLATES } from '~/utils/art-studio/catalog'
import { cloneArt } from '~/utils/art-studio/composition'
import { runArtPython } from '~/server/utils/art-studio-python'
import { enforceRateLimit } from '~/server/utils/rate-limit'
export default defineEventHandler(async (event) => {
  const user = await artUser(event, true)
  await enforceRateLimit(event, `art-generate:${user.id}`, 10, 60_000)
  const data = parseArtInput(
    z.object({
      title: z.string().trim().min(1).max(300),
      message: z.string().max(1000),
      theme: z.string().max(120),
      background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      formats: z
        .array(
          z.object({
            width: z.number().int().min(320).max(4096),
            height: z.number().int().min(320).max(4096)
          })
        )
        .min(1)
        .max(8)
    }),
    await readBody(event)
  )
  const composition = cloneArt(ART_STARTER_TEMPLATES[10]!.composition)
  composition.background = data.background
  for (const layer of composition.layers) {
    layer.fill = data.color
    if (layer.name === 'Título') layer.text = data.title
    if (layer.name === 'Mensagem') layer.text = data.message
    if (layer.name === 'Tema') layer.text = data.theme
  }
  const result = await runArtPython({
    mode: 'compose',
    composition,
    formats: data.formats
  })
  return {
    compositions: (result.compositions || []).map((value) =>
      parseArtInput(artCompositionSchema, value)
    ),
    engine: 'Pillow'
  }
})
