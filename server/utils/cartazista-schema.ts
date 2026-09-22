import { z } from 'zod'
export { cartazistaDesignSchema, cartazistaDocumentSchema } from '~/utils/cartazista/schema'

export const parseCartazistaInput = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dados do cartaz inválidos. Revise os campos.',
      data: parsed.error.flatten()
    })
  }
  return parsed.data
}
