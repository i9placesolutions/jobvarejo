import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CARTAZISTA_FORMATS, CARTAZISTA_THEMES } from '../../types/cartazista'
import { isCartazistaModelKey } from '../../utils/cartazista/catalog'
import { VIDEO_THEMES } from '../../shared/video-studio/model'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.mock('../../server/utils/s3', () => ({ getPublicUrl: (key: string) => `https://assets.test/${key}` }))

const { listCreationHeaders, listProductCandidates, normalizeCreationTheme } = await import('../../server/utils/whatsapp-creation/catalog')
const accountId = '11111111-1111-4111-8111-111111111111'

beforeEach(() => vi.resetAllMocks())

describe('catálogo de criação pelo WhatsApp', () => {
  it('normaliza acentos e aliases de tema sem confundir temas não relacionados', () => {
    expect(normalizeCreationTheme('Fecha Mês')).toBe('fecha mes')
    expect(normalizeCreationTheme('fechames')).toBe('fecha mes')
    expect(normalizeCreationTheme('FIMSEMANA')).toBe('fim de semana')
    expect(normalizeCreationTheme('Festival do Churrasco')).toBe('festival do churrasco')
    expect(normalizeCreationTheme('Festival do Churrasco')).not.toBe(normalizeCreationTheme('Feira de ofertas'))
  })

  it('consulta apenas modelos de encarte próprios ou da biblioteca pública e exige todos os formatos pedidos', async () => {
    mocks.query.mockResolvedValue({ rows: [
      {
        id: 'template-story-feed', name: 'Fecha Mês Completo', owner_id: accountId,
        updated_at: '2026-10-03T14:15:00.000Z', preview_url: null,
        template_config: { category: 'Fecha Mês', formatIds: ['story', 'feed'], assets: { header: { key: `projects/${accountId}/asset/header.png` } } },
        page_metadata: [{ id: 'page-1', templateFormatId: 'story', canvasData: { secret: 'must not be queried inline' } }]
      },
      {
        id: 'template-feed-only', name: 'Fecha Mês Feed', owner_id: accountId,
        updated_at: '2026-10-03T13:00:00.000Z', preview_url: 'https://private.invalid/private.png',
        template_config: { category: 'Fecha Mês', formatIds: ['feed'] }, page_metadata: []
      },
      {
        id: 'template-other-theme', name: 'Feira', owner_id: accountId,
        updated_at: '2026-10-03T12:00:00.000Z', preview_url: null,
        template_config: { category: 'Feira de ofertas', formatIds: ['story', 'feed'] }, page_metadata: []
      }
    ] })

    const result = await listCreationHeaders(accountId, 'encarte', 'Fecha Mês', ['story', 'feed'])

    expect(result).toMatchObject({ hasMore: false, missingTheme: false })
    expect(result.headers).toEqual([{
      id: 'template-story-feed',
      revision: Date.parse('2026-10-03T14:15:00.000Z'),
      theme: 'Fecha Mês',
      formats: ['story', 'feed'],
      name: 'Fecha Mês Completo',
      headerKey: `projects/${accountId}/asset/header.png`,
      sourceOwnerId: accountId,
      sourceUpdatedAt: '2026-10-03T14:15:00.000Z'
    }])
    const [sql, params] = mocks.query.mock.calls[0]!
    expect(sql).toContain('project.is_template')
    expect(sql).toContain("owner.role in ('admin', 'super_admin')")
    expect(sql).toContain("page.value - 'canvasData' - 'canvas_data'")
    expect(sql).not.toMatch(/select\s+project\.\*/i)
    expect(params).toEqual([accountId])
  })

  it('trata tema de encarte como família por prefixo de frase completa, sem ampliar temas específicos', async () => {
    const makeTemplate = (id: string, name: string, subcategory: string, formatIds = ['stories']) => ({
      id,
      name,
      owner_id: accountId,
      updated_at: '2026-10-05T15:16:39.000Z',
      preview_url: null,
      template_config: { category: 'Hortifruti', subcategory, formatIds },
      page_metadata: []
    })
    const rows = [
      makeTemplate('7506f335-2bf6-4650-8206-b283585a5a16', 'Terça e quarta verde', 'Terça e quarta verde'),
      makeTemplate('4b8b98f0-9a34-46e3-ab41-ddcc6135c79d', 'Terça e quarta verde', 'Terça e quarta verde'),
      makeTemplate('66aaabb8-33ef-43f3-a3f4-f8cb406f8862', 'Terça e quarta mais verde', 'Terça e quarta mais verde'),
      makeTemplate('2db9ae75-936e-4f95-815c-636a3c5bb0c4', 'Terça e quarta mais verde', 'Terça e quarta mais verde'),
      makeTemplate('ab7f7789-7298-4b34-b4c7-6d8f583d870a', 'Terça e quarta verde', 'Terça e quarta verde'),
      makeTemplate('tuesday-green', 'Terça verde', 'Terça verde'),
      makeTemplate('wednesday-green', 'Quarta verde', 'Quarta verde'),
      makeTemplate('monday-tuesday', 'Segunda e terça', 'Segunda e terça'),
      makeTemplate('name-only-match', 'Terça e quarta', 'Liquidação'),
      makeTemplate('wrong-format', 'Terça e quarta verde feed', 'Terça e quarta verde', ['feed']),
      makeTemplate('fair-offers', 'Feira de ofertas', 'Feira de ofertas')
    ]

    mocks.query.mockResolvedValueOnce({ rows })
    const family = await listCreationHeaders(accountId, 'encarte', 'TERÇA E QUARTA', ['stories'])
    expect(family.headers.map(header => header.id)).toEqual([
      '7506f335-2bf6-4650-8206-b283585a5a16',
      '4b8b98f0-9a34-46e3-ab41-ddcc6135c79d',
      '66aaabb8-33ef-43f3-a3f4-f8cb406f8862',
      '2db9ae75-936e-4f95-815c-636a3c5bb0c4'
    ])
    expect(family.headers[0]).toMatchObject({
      revision: 1791213399000,
      theme: 'Hortifruti',
      formats: ['stories']
    })
    expect(family.headers[0]?.sourceOwnerId).toBe(accountId)
    expect(family.hasMore).toBe(true)
    expect(family.missingTheme).toBe(false)
    mocks.query.mockResolvedValueOnce({ rows })
    const remainingFamily = await listCreationHeaders(accountId, 'encarte', 'TERÇA E QUARTA', ['stories'], 4)
    expect(remainingFamily.headers.map(header => header.id)).toEqual(['ab7f7789-7298-4b34-b4c7-6d8f583d870a'])
    expect([...family.headers, ...remainingFamily.headers].map(header => header.id)).toHaveLength(5)

    mocks.query.mockResolvedValueOnce({ rows })
    const specific = await listCreationHeaders(accountId, 'encarte', 'Terça e quarta mais verde', ['stories'])
    expect(specific.headers.map(header => header.id)).toEqual([
      '66aaabb8-33ef-43f3-a3f4-f8cb406f8862',
      '2db9ae75-936e-4f95-815c-636a3c5bb0c4'
    ])

    mocks.query.mockResolvedValueOnce({ rows: [rows[9]] })
    const incompatible = await listCreationHeaders(accountId, 'encarte', 'TERÇA E QUARTA', ['stories'])
    expect(incompatible.headers).toEqual([])
    expect(incompatible.missingTheme).toBe(false)

    mocks.query.mockResolvedValueOnce({ rows })
    const shortTheme = await listCreationHeaders(accountId, 'encarte', 'Feira', ['stories'])
    // Sem modelo com o tema exato, oferece os de tema parecido (feira → hortifruti/verde).
    expect(shortTheme.missingTheme).toBe(true)
    expect(shortTheme.headers.length).toBeGreaterThan(0)
    expect(shortTheme.headers.every(header => header.related)).toBe(true)
    expect(shortTheme.relatedThemes?.length).toBeGreaterThan(0)
  })

  it('relaciona temas parecidos por sinônimo sem confundir dia da semana', async () => {
    const { encarteThemeAffinity } = await import('../../server/utils/whatsapp-creation/catalog')
    expect(encarteThemeAffinity('quarta da carne', 'Açougue', '')).toBeGreaterThanOrEqual(1)
    expect(encarteThemeAffinity('quarta da carne', 'Açougue', 'Quinta da Carne')).toBeGreaterThan(encarteThemeAffinity('quarta da carne', 'Hortifruti', 'Quarta mais verde'))
    expect(encarteThemeAffinity('oferta de carne', 'Açougue', '')).toBeGreaterThanOrEqual(1)
    expect(encarteThemeAffinity('oferta de carne', 'Ofertas gerais', 'Ofertas do Dia')).toBe(0)
    expect(encarteThemeAffinity('frutas e verduras', 'Hortifruti', 'Dia de Hortifruti')).toBeGreaterThanOrEqual(1)
  })

  it('usa a página Story salva para preparar só o cabeçalho quando o formato ainda não foi escolhido', async () => {
    const prefix = `projects/${accountId}/22222222-2222-4222-8222-222222222222/`
    mocks.query.mockResolvedValue({ rows: [{
      id: '22222222-2222-4222-8222-222222222222', owner_id: accountId, name: 'Hortifruti',
      updated_at: '2026-10-04T10:00:00.000Z', preview_url: `${prefix}flyer.webp`,
      template_config: { category: 'Hortifruti', formatIds: ['feed', 'stories'] },
      page_metadata: [
        { templateFormatId: 'feed', height: 1350, thumbnailPath: `${prefix}feed.webp`, canvasDataPath: `${prefix}feed.json.gz` },
        { templateFormatId: 'stories', height: 1920, thumbnailPath: `${prefix}story.webp`, canvasDataPath: `${prefix}story.json.gz` }
      ]
    }] })
    const result = await listCreationHeaders(accountId, 'encarte', 'Hortifruti', [])
    expect(result.headers[0]).toMatchObject({
      sourceThumbnailKey: `${prefix}story.webp`, sourceCanvasKey: `${prefix}story.json.gz`, sourcePageHeight: 1920
    })
    expect(result.headers[0]).not.toHaveProperty('previewUrl')
  })

  it('prioriza um cabeçalho preferido autorizado e compatível mesmo fora da primeira página', async () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `template-${index + 1}`, name: `Fecha Mês ${index + 1}`, owner_id: accountId,
      updated_at: `2026-10-03T14:15:0${index}.000Z`, preview_url: null,
      template_config: { category: 'Fecha Mês', formatIds: ['stories'] }, page_metadata: []
    }))
    rows.push({
      id: 'wrong-theme', name: 'Feira', owner_id: accountId,
      updated_at: '2026-10-03T14:15:10.000Z', preview_url: null,
      template_config: { category: 'Feira', formatIds: ['stories'] }, page_metadata: []
    })
    mocks.query.mockResolvedValueOnce({ rows })

    const preferred = await listCreationHeaders(accountId, 'encarte', 'Fecha Mês', ['stories'], 0, 'template-6')

    expect(preferred.headers.map(header => header.id)).toEqual(['template-6', 'template-1', 'template-2', 'template-3'])
    expect(preferred.hasMore).toBe(true)
    const [sql] = mocks.query.mock.calls[0]!
    expect(sql).toContain('project.is_template')
    expect(sql).toContain("owner.role in ('admin', 'super_admin')")

    mocks.query.mockResolvedValueOnce({ rows })
    const incompatible = await listCreationHeaders(accountId, 'encarte', 'Fecha Mês', ['stories'], 0, 'wrong-theme')
    expect(incompatible.headers[0]?.id).toBe('template-1')
    expect(incompatible.headers.some(header => header.id === 'wrong-theme')).toBe(false)
  })

  it('usa IDs nativos de vídeo e de cabeçalho do Cartazista', async () => {
    const video = await listCreationHeaders(accountId, 'video', 'Fecha Mês', ['stories', 'tv'])
    expect(video.headers).toHaveLength(1)
    expect(video.headers[0]).toMatchObject({ id: 'impact', formats: ['stories', 'tv'] })
    expect(VIDEO_THEMES.some(theme => theme.id === video.headers[0]?.id)).toBe(true)

    mocks.query.mockResolvedValueOnce({ rows: [] })
    const poster = await listCreationHeaders(accountId, 'cartaz', 'Amarelo Clássico', ['a4', 'a7'])
    expect(poster.headers[0]).toMatchObject({ id: 'standard', theme: 'Amarelo Clássico', nativeThemeId: 'classic-yellow', formats: ['a4', 'a7'] })
    expect(isCartazistaModelKey(poster.headers[0]!.id)).toBe(true)
    expect(CARTAZISTA_THEMES.some(theme => theme.id === poster.headers[0]?.nativeThemeId)).toBe(true)
    expect(poster.headers[0]).not.toHaveProperty('headerKey')
    expect(poster.headers[0]).not.toHaveProperty('previewUrl')

    mocks.query.mockResolvedValueOnce({ rows: [] })
    const butcher = await listCreationHeaders(accountId, 'cartaz', 'Açougue · Vermelho e Ouro', ['a4'])
    expect(butcher.headers[0]?.nativeThemeId).toBe('acougue-gold')
    expect(butcher.headers[0]?.formats.every(id => CARTAZISTA_FORMATS.some(format => format.id === id))).toBe(true)
  })

  it('não converte formatos de outro tipo em formatos nativos de vídeo ou cartaz', async () => {
    const video = await listCreationHeaders(accountId, 'video', 'Fecha Mês', ['feed'])
    expect(video.headers).toEqual([])
    expect(video.missingTheme).toBe(false)

    mocks.query.mockResolvedValueOnce({ rows: [] })
    const poster = await listCreationHeaders(accountId, 'cartaz', 'Alerta de Oferta', ['stories'])
    expect(poster.headers).toEqual([])
    expect(poster.missingTheme).toBe(false)
  })

  it('lista somente modelos publicados do Estúdio e omite preview que não foi salvo', async () => {
    mocks.query.mockResolvedValue({ rows: [{
      id: '22222222-2222-4222-8222-222222222222', owner_id: accountId, name: 'Dia do Cliente',
      category: 'Institucional', tags: ['aniversário da loja'], revision: 4,
      updated_at: '2026-10-03T10:00:00.000Z', composition: { width: 1080, height: 1350, layers: [] }
    }] })

    const result = await listCreationHeaders(accountId, 'studio', 'Institucional', ['feed'])
    expect(result.headers[0]).toMatchObject({ id: '22222222-2222-4222-8222-222222222222', revision: 4, formats: ['feed'] })
    expect(result.headers[0]).not.toHaveProperty('previewUrl')
    expect(mocks.query.mock.calls[0]?.[0]).toContain('where published = true')
  })

  it('retorna no máximo três imagens reais de produtos e rejeita chaves fora do prefixo público', async () => {
    mocks.query.mockResolvedValue({ rows: [
      { id: 1, product_name: 'Arroz Tio João 5 kg', search_term: 'arroz tio joao', brand: 'Tio João', flavor: '', weight: '5kg', image_url: 'x', s3_key: 'imagens/arroz-exato.png', usage_count: 1 },
      { id: 2, product_name: 'Arroz Tio João 5kg', search_term: 'arroz tio joao', brand: 'Tio João', flavor: '', weight: '5 kg', image_url: 'x', s3_key: 'imagens/arroz-alternativo.png', usage_count: 12 },
      { id: 3, product_name: 'Arroz Tio João 5kg', search_term: 'arroz tio joao', brand: 'Outra Marca', flavor: '', weight: '5 kg', image_url: 'x', s3_key: 'imagens/marca-errada.png', usage_count: 50 },
      { id: 4, product_name: 'Arroz Tio João 5kg', search_term: 'arroz tio joao', brand: 'Tio João', flavor: '', weight: '5kg', image_url: 'x', s3_key: 'projects/other-user/private.png', usage_count: 100 }
    ] })

    const candidates = await listProductCandidates(accountId, { name: 'Arroz Tio João 5 kg', brand: 'Tio João', weight: '5kg' })

    expect(candidates).toHaveLength(2)
    expect(candidates.map(item => item.key)).toEqual(['imagens/arroz-exato.png', 'imagens/arroz-alternativo.png'])
    expect(candidates[0]?.previewUrl).toContain('/imagens/arroz-exato.png')
    expect(mocks.query.mock.calls[0]?.[0]).toContain("s3_key like 'imagens/%'")
  })

  it('não confunde ingrediente ou sabor com a identidade do produto', async () => {
    mocks.query.mockResolvedValue({ rows: [
      { id: 1, product_name: 'Mistura para bolo sabor cenoura', search_term: 'cenoura', brand: '', flavor: 'Cenoura', weight: '', image_url: 'x', s3_key: 'imagens/mistura-cenoura.png', usage_count: 100 },
      { id: 2, product_name: 'Massa para bolo sabor cenoura', search_term: 'cenoura', brand: '', flavor: 'Cenoura', weight: '', image_url: 'x', s3_key: 'imagens/massa-cenoura.png', usage_count: 200 }
    ] })

    await expect(listProductCandidates(accountId, { name: 'Cenoura' })).resolves.toEqual([])
  })

  it('mantém verduras como identidade própria e aceita pedido explícito de massa sabor cenoura', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [
      { id: 1, product_name: 'Beterraba', search_term: 'beterraba', brand: '', flavor: '', weight: '', image_url: 'x', s3_key: 'imagens/beterraba.png', usage_count: 1 }
    ] })
    await expect(listProductCandidates(accountId, { name: 'Beterraba' })).resolves.toMatchObject([
      { name: 'Beterraba', key: 'imagens/beterraba.png' }
    ])

    mocks.query.mockResolvedValueOnce({ rows: [
      { id: 2, product_name: 'Repolho', search_term: 'repolho', brand: '', flavor: '', weight: '', image_url: 'x', s3_key: 'imagens/repolho.png', usage_count: 1 }
    ] })
    await expect(listProductCandidates(accountId, { name: 'Repolho' })).resolves.toMatchObject([
      { name: 'Repolho', key: 'imagens/repolho.png' }
    ])

    mocks.query.mockResolvedValueOnce({ rows: [
      { id: 3, product_name: 'Massa para bolo sabor cenoura', search_term: 'cenoura', brand: '', flavor: 'Cenoura', weight: '', image_url: 'x', s3_key: 'imagens/massa-cenoura.png', usage_count: 1 }
    ] })
    await expect(listProductCandidates(accountId, { name: 'Massa bolo cenoura' })).resolves.toMatchObject([
      { name: 'Massa para bolo sabor cenoura', key: 'imagens/massa-cenoura.png' }
    ])
  })
})
