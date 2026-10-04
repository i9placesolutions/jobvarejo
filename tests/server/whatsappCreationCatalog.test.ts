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
})
