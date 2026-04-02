// Cancelar transacao de edicao no Canva

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { transaction_id } = body

  if (!transaction_id) {
    throw createError({ statusCode: 400, message: 'transaction_id e obrigatorio' })
  }

  await canvaCancelEditingTransaction(transaction_id)

  return { success: true }
})
