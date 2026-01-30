export default defineEventHandler(async (event) => {
  return {
    message: 'TESTE API funcionando!',
    timestamp: new Date().toISOString()
  }
})
