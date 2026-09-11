import type { H3Event } from 'h3'
import type { ArtComposition } from '~/types/art-studio'
import { requireAuthenticatedUser } from './auth'
import { pgQuery } from './postgres'
import { enforceRateLimit } from './rate-limit'
export const artUser = async (event: H3Event, admin = false) => {
  const user = await requireAuthenticatedUser(event)
  if (admin && user.role !== 'super_admin')
    throw createError({
      statusCode: 403,
      statusMessage: 'Somente o super admin pode administrar modelos.'
    })
  await enforceRateLimit(event, `art-studio:${user.id}`, 180, 60_000)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return user
}
export const artId = (event: H3Event) => {
  const id = getRouterParam(event, 'id') || ''
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw createError({
      statusCode: 400,
      statusMessage: 'Identificador inválido.'
    })
  return id
}
export const artAssetIds = (composition: ArtComposition) => [
  ...new Set(
    [composition, ...(composition.alternates || [])]
      .flatMap((page) => page.layers)
      .filter(
        (l) =>
          l.kind === 'image' && l.src?.startsWith('/api/art-studio/assets/')
      )
      .map((l) => l.src!.split('/').pop()!)
  )
]
export const checkArtAssets = async (
  composition: ArtComposition,
  userId: string
) => {
  const ids = artAssetIds(composition)
  if (!ids.length) return
  const rows = await pgQuery(
    'SELECT id FROM public.art_studio_assets WHERE id = ANY($1::uuid[]) AND (owner_id = $2 OR shared = true)',
    [ids, userId]
  )
  if (rows.rowCount !== ids.length)
    throw createError({
      statusCode: 403,
      statusMessage: 'Uma imagem não está disponível para esta conta.'
    })
}
export const artDatabaseError = (error: any): never => {
  if (error?.code === '42P01')
    throw createError({
      statusCode: 503,
      statusMessage:
        'O banco do Estúdio de Artes ainda precisa ser configurado.'
    })
  throw error
}

// Modelos publicados nunca carregam valores de uma marca em campos dinâmicos.
export const normalizeArtTemplateBindings = (composition: ArtComposition) => {
  const placeholders: Record<string, string> = {
    companyName: 'Sua empresa',
    phone: 'Seu telefone',
    address: 'Seu endereço',
    instagram: '@suaempresa',
    date: 'Sua data'
  }
  for (const layer of [composition, ...(composition.alternates || [])].flatMap(
    (page) => page.layers
  )) {
    if (layer.binding === 'logo' && layer.kind === 'image') layer.src = ''
    if (layer.binding && layer.kind === 'text' && placeholders[layer.binding])
      layer.text = placeholders[layer.binding]
  }
  return composition
}
