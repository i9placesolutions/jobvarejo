// Limite apenas para o novo módulo; não modifica upload/parsing dos editores existentes.
export default defineEventHandler((event) => {
  if (
    !event.path.startsWith('/api/art-studio/') ||
    !['POST', 'PUT', 'PATCH'].includes(event.method)
  )
    return
  const value = getHeader(event, 'content-length'),
    size = Number(value)
  if (!value || !Number.isSafeInteger(size) || size < 0)
    throw createError({
      statusCode: 411,
      statusMessage: 'Informe o tamanho do conteúdo da requisição.'
    })
  const limit = event.path.startsWith('/api/art-studio/assets')
    ? 12 * 1024 * 1024
    : 2 * 1024 * 1024
  if (size > limit)
    throw createError({
      statusCode: 413,
      statusMessage: 'O arquivo excede o limite permitido.'
    })
})
