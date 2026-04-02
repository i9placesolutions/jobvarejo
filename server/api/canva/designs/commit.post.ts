// Confirmar (commit) transacao de edicao no Canva

import { canvaCommitEditingTransaction } from '../../../utils/canva-client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { transaction_id } = body

  if (!transaction_id) {
    throw createError({ statusCode: 400, message: 'transaction_id e obrigatorio' })
  }

  await canvaCommitEditingTransaction(transaction_id)

  return { success: true }
})
