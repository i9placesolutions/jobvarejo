import { z } from 'zod'
import type { AiCanvasData } from './aiTypes'

const numberLike = z.coerce.number().finite()

const fabricObjectSchema = z.object({
  type: z.string().min(1)
}).passthrough()

const frameSchema = z.object({
  type: z.string().min(1),
  name: z.string(),
  isFrame: z.literal(true),
  layerName: z.string(),
  left: numberLike,
  top: numberLike,
  width: numberLike.positive(),
  height: numberLike.positive(),
  fill: z.string().min(1),
  selectable: z.boolean(),
  evented: z.boolean()
}).passthrough()

export const aiCanvasSchema = z.object({
  version: z.literal('7.1.0'),
  objects: z.array(fabricObjectSchema).min(1)
}).passthrough()

const isRectType = (value: unknown) => String(value || '').toLowerCase() === 'rect'

const visitObjects = (objects: any[], visitor: (obj: any) => void) => {
  const stack = [...objects]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    visitor(current)
    if (Array.isArray((current as any).objects)) {
      stack.push(...(current as any).objects)
    }
  }
}

export const validateAiCanvasData = (
  input: unknown,
  expectedSize: { width: number; height: number }
): AiCanvasData => {
  const parsed = aiCanvasSchema.parse(input)
  const width = Math.max(1, Math.round(Number(expectedSize?.width || 1080)))
  const height = Math.max(1, Math.round(Number(expectedSize?.height || 1920)))

  const frameCandidate = parsed.objects.find((obj: any) => {
    return obj?.isFrame === true && isRectType(obj?.type)
  })

  if (!frameCandidate) {
    throw new Error('JSON invalido: frame obrigatorio nao encontrado.')
  }

  const frame = frameSchema.parse(frameCandidate)
  if (!isRectType(frame.type)) {
    throw new Error('JSON invalido: frame deve ter type Rect.')
  }

  const frameLeft = Number(frame.left || 0)
  const frameTop = Number(frame.top || 0)
  const frameWidth = Math.round(Number(frame.width || 0))
  const frameHeight = Math.round(Number(frame.height || 0))

  if (Math.abs(frameLeft) > 0.1 || Math.abs(frameTop) > 0.1) {
    throw new Error('JSON invalido: frame deve iniciar em left=0 e top=0.')
  }
  if (frameWidth !== width || frameHeight !== height) {
    throw new Error(`JSON invalido: frame deve ter tamanho ${width}x${height}.`)
  }

  visitObjects(parsed.objects, (obj) => {
    const type = String(obj?.type || '').toLowerCase()
    if (type !== 'image') return
    const src = String(obj?.src || '').trim().toLowerCase()
    if (!src) return
    if (src.startsWith('http://') || src.startsWith('https://')) {
      throw new Error('JSON invalido: imagens externas nao sao permitidas nesta geracao.')
    }
  })

  return parsed as AiCanvasData
}
