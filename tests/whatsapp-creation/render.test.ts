import { describe, expect, it } from 'vitest'
import {
  approveData,
  approveImage,
  assertCanRender,
  createOrder,
  setImageCandidates,
  splitPageSizes,
  updateOrder
} from '../../shared/whatsapp-creation'
import {
  deterministicUuid,
  readFlyerPaymentIcon,
  resolvePublishedFlyerCatalogKey,
  flyerTemplateRevision,
  flyerThemeMatchesOrder,
  flyerDivisionSupportsProductCount,
  assertFlyerProfileBindings,
  hydrateFlyerBusinessFields,
  applyBusinessOverrides,
  formatSimpleValidityText,
  renderEditableFlyerCanvas,
  applyFlyerAccountLabelTemplates,
  applyFlyerLogoStickers,
  approvedProductImages,
  isPublishedArtAssetStorageKey,
  headerRevisionChangedError,
  fillHeaderPreviewPlaceholders,
  renderCreationHeaderPreview,
  resolveVideoHeaderPreviewAsset
} from '../../server/utils/whatsapp-creation/render'
import { parseLiteralValidityPeriod } from '../../server/utils/whatsapp-creation/validity-period'
import { flyerHeaderCropHeight, flyerHeaderLogoBox } from '../../server/utils/whatsapp-creation/header-preview'
import type { BusinessProfile } from '../../utils/businessProfile'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { createDefaultProductCardConfiguration, resolveProductCardConfigurationProfile } from '../../utils/product-card-configuration'

const pythonWithPlaywright = (() => {
  try {
    execFileSync(process.env.PRODUCT_IMAGE_PYTHON || 'python3', ['-c', 'import os; from pathlib import Path; from playwright.sync_api import sync_playwright; p=sync_playwright().start(); assert Path(os.environ.get("WHATSAPP_CREATION_CHROMIUM_EXECUTABLE") or p.chromium.executable_path).is_file(); p.stop()'], { stdio: 'ignore' })
    return true
  } catch { return false }
})()

const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const orderId = '33333333-3333-4333-8333-333333333333'

const profile = {
  companyName: 'Mercado Central', logo: '', phone: '11999999999', whatsapp: '+5511999999999',
  whatsappNumbers: [{ id: 'main', label: '', value: '+5511999999999' }], address: 'Rua Central, 10', addresses: [{ id: 'main', label: '', value: 'Rua Central, 10' }], instagram: '@mercadocentral',
  facebook: '', website: '', slogan: '', cep: '', hours: '', paymentNotes: '', footerPaymentImages: [], paymentMethods: []
} satisfies BusinessProfile

const order = (imageKey = `imagens/${userId}/rice.png`, imageHash = 'hash') => {
  let value = createOrder({
    id: orderId,
    identity: { accountId: userId, normalizedSender: '+5511999999999' },
    kind: 'encarte', theme: 'Fecha Mês', formats: [{ id: 'stories', width: 1080, height: 1920 }],
    division: 'single', products: [{ id: 'rice', name: 'Arroz', brand: 'Marca', variant: 'Tipo 1', weight: '5 kg', price: 'R$ 19,90' }]
  })
  value = updateOrder(value, userId, { header: { id: 'header-id', revision: 1, theme: 'Fecha Mês', formats: ['stories'] } })
  value = setImageCandidates(value, userId, [{ itemId: 'rice', key: imageKey, hash: imageHash }])
  value = approveImage(value, userId, { itemId: 'rice', key: imageKey, hash: imageHash })
  return approveData(value, userId)
}


describe('adapter de render da criação WhatsApp', () => {
  it('usa a etiqueta Padrão atual da conta e mantém a escolha explícita do modelo', () => {
    const canvas = { __labelTemplates: [
      { id: 'tpl_default', name: 'Padrão antigo', group: { objects: [{ name: 'price_bg', fill: '#111111' }] } },
      { id: 'custom-label', name: 'Escolhida no modelo', group: { objects: [{ name: 'price_bg', fill: '#222222' }] } }
    ], objects: [
      { isProductZone: true, _zoneGlobalStyles: { prodNameFont: 'Barlow' } },
      { isProductZone: true, _zoneGlobalStyles: { splashTemplateId: 'custom-label' } }
    ] }
    applyFlyerAccountLabelTemplates(canvas, [
      { id: 'tpl_default', name: 'Padrão da conta', group: { objects: [{ name: 'price_bg', fill: '#ff0000' }] } }
    ])
    expect(canvas.objects[0]?._zoneGlobalStyles).toMatchObject({ prodNameFont: 'Barlow', splashTemplateId: 'tpl_default' })
    expect(canvas.objects[1]?._zoneGlobalStyles.splashTemplateId).toBe('custom-label')
    expect(canvas.__labelTemplates.find((item: any) => item.id === 'tpl_default')?.group.objects[0]?.fill).toBe('#ff0000')
    expect(canvas.__labelTemplates.find((item: any) => item.id === 'custom-label')?.group.objects[0]?.fill).toBe('#222222')
  })
  it('recorta a miniatura na fronteira real entre cabeçalho e produtos', () => {
    const canvas = { objects: [
      { name: 'header-validity', top: 492 },
      { name: 'product-section-surface', originY: 'top', top: 518 }
    ] }
    expect(flyerHeaderCropHeight(canvas, 1920, 1422)).toBe(384)
    expect(() => flyerHeaderCropHeight({ objects: [] }, 1920, 1422)).toThrow(/não informa onde termina/i)
    expect(flyerHeaderLogoBox({ objects: [{ quickLogoSlot: true, left: 585, top: 132, width: 398, height: 213, scaleX: 1.18, scaleY: 1.18 }] }, 1920, 800, 1422))
      .toMatchObject({ left: 425, top: 89, width: 365, height: 203 })
  })
  it('gera IDs nativos determinísticos por conta/pedido/revisão', () => {
    expect(deterministicUuid(`${userId}:${orderId}:r1`)).toMatch(/^[0-9a-f-]{36}$/)
    expect(deterministicUuid(`${userId}:${orderId}:r1`)).toBe(deterministicUuid(`${userId}:${orderId}:r1`))
    expect(deterministicUuid(`${userId}:${orderId}:r1`)).not.toBe(deterministicUuid(`${otherId}:${orderId}:r1`))
  })

  it('mapeia updated_at do projeto ao revision integer e permite detectar cabeçalho obsoleto', () => {
    const selectedRevision = flyerTemplateRevision('2026-10-03T12:00:00.000Z')
    expect(selectedRevision).toBe(Date.parse('2026-10-03T12:00:00.000Z'))
    expect(flyerTemplateRevision('2026-10-03T12:00:00.000Z')).toBe(selectedRevision)
    expect(flyerTemplateRevision('2026-10-03T12:00:01.000Z')).not.toBe(selectedRevision)
    expect(flyerTemplateRevision(new Date('2026-10-04T02:54:56.083Z'))).toBe(1791082496083)
    expect(flyerTemplateRevision('2026-10-04T02:54:56.083Z')).toBe(1791082496083)
    expect(() => flyerTemplateRevision('not-a-date')).toThrow()
  })

  it('marca somente revisão desatualizada de cabeçalho com código recuperável', () => {
    const error = headerRevisionChangedError('O cabeçalho mudou depois da escolha.')
    expect(error).toMatchObject({ statusCode: 409, statusMessage: 'O cabeçalho mudou depois da escolha.', data: { code: 'HEADER_REVISION_CHANGED' } })
  })

  it('reconhece tema por slug ou nome e aceita paginação Story por departamento', () => {
    expect(flyerThemeMatchesOrder('Semana de Ofertas', ['semana-de-ofertas', 'Semana de Ofertas'])).toBe(true)
    expect(flyerThemeMatchesOrder('Data diferente', ['semana-de-ofertas', 'Semana de Ofertas'])).toBe(false)
    expect(flyerDivisionSupportsProductCount(10, 'department', { width: 1080, height: 1920 })).toBe(true)
    expect(flyerDivisionSupportsProductCount(10, 'pages', { width: 1080, height: 1920 })).toBe(true)
    expect(flyerDivisionSupportsProductCount(10, 'single', { width: 1080, height: 1920 })).toBe(false)
  })

  it('substitui os campos comerciais antigos do template pela marca real da conta', () => {
    const canvas = { objects: [
      { type: 'textbox', businessProfileField: 'companyName', text: 'Loja do template', visible: true },
      { type: 'textbox', businessProfileField: 'address', text: 'Endereço do template', visible: true },
      { type: 'textbox', businessProfileField: 'whatsapp', businessProfileEntryIndex: 0, dynamicTextCase: 'upper', text: 'Número do template', visible: true },
      { type: 'Image', quickLogoSlot: true, src: 'imagens/logo-dono.png', visible: true },
      { type: 'image', quickLogoBackdrop: true, visible: true }
    ] }
    hydrateFlyerBusinessFields(canvas, profile, 'data:image/png;base64,YQ==')
    expect(canvas.objects[0]).toMatchObject({ text: 'Mercado Central', visible: true })
    expect(canvas.objects[1]).toMatchObject({ text: 'Rua Central, 10', visible: true })
    expect(canvas.objects[2]).toMatchObject({ text: '(11) 99999-9999', __rawText: '(11) 99999-9999', visible: true })
    expect(canvas.objects[3]).toMatchObject({ src: 'data:image/png;base64,YQ==', visible: true })

    const noLogo = hydrateFlyerBusinessFields(JSON.parse(JSON.stringify(canvas)), profile, '')
    expect(noLogo.objects[3]).toMatchObject({ src: '', visible: false })
  })

  it('usa somente a validade aprovada no slot nativo e esconde datas antigas quando vazia', () => {
    const saved = {
      objects: [{ type: 'textbox', name: 'header-validity', _customId: 'validity-1',
        text: 'OFERTAS VÁLIDAS DE 01/04 A 07/04', left: 286, top: 521, width: 549, height: 48,
        fontSize: 42, fill: '#111', visible: true }]
    }
    hydrateFlyerBusinessFields(saved, profile, 'data:image/png;base64,YQ==', { validity: '01/10 A 07/10', conditions: '' })
    expect(saved.objects[0]).toMatchObject({ text: '01/10 A 07/10', _customId: 'validity-1', left: 286, top: 521, width: 549, height: 48, fontSize: 42, fill: '#111', visible: true })

    const noValidity = JSON.parse(JSON.stringify(saved))
    hydrateFlyerBusinessFields(noValidity, profile, 'data:image/png;base64,YQ==', { validity: '', conditions: '' })
    expect(noValidity.objects[0]).toMatchObject({ text: '', _customId: 'validity-1', visible: false })
  })

  it('formata uma data aprovada com a mesma regra de validade do Editor Rápido', () => {
    const canvas = { objects: [{ type: 'textbox', name: 'header-validity',
      quickDataField: 'validity', quickValidityLayout: 'inline-footer',
      quickValidityWhileStocks: true, quickValidityDateFormat: 'numeric',
      text: 'OFERTAS VÁLIDAS ENQUANTO DURAREM OS ESTOQUES', visible: true }] }
    hydrateFlyerBusinessFields(canvas, profile, '', { validity: '05/10/2026', conditions: '' })
    expect(canvas.objects[0]).toMatchObject({
      text: 'OFERTA VÁLIDA DE 05/10/2026 OU ENQUANTO DURAREM OS ESTOQUES',
      quickValidityStartDate: '2026-10-05', quickValidityEndDate: '2026-10-05',
      quickValidityMode: 'single_day', visible: true
    })
  })

  it('formata intervalo escrito por extenso no mesmo padrão do Editor Rápido', () => {
    const canvas = { objects: [{ type: 'textbox', name: 'header-validity',
      quickDataField: 'validity', quickValidityLayout: 'inline-footer',
      quickValidityWhileStocks: true, quickValidityDateFormat: 'numeric',
      text: 'OFERTAS VÁLIDAS ENQUANTO DURAREM OS ESTOQUES', visible: true }] }
    hydrateFlyerBusinessFields(canvas, profile, '', { validity: '06 e 07 de outubro de 2026', conditions: '' })
    expect(canvas.objects[0]).toMatchObject({
      text: 'OFERTA VÁLIDA DE 06/10/2026 A 07/10/2026 OU ENQUANTO DURAREM OS ESTOQUES',
      quickValidityStartDate: '2026-10-06', quickValidityEndDate: '2026-10-07',
      quickValidityMode: 'date_range', visible: true
    })
  })

  it('interpreta as validades escritas pelo cliente sem inventar datas ambíguas', () => {
    const today = new Date('2026-10-06T12:00:00-03:00')
    expect(parseLiteralValidityPeriod('06 e 07 de outubro', today)).toEqual({ startDate: '2026-10-06', endDate: '2026-10-07', mode: 'date_range' })
    expect(parseLiteralValidityPeriod('Ofertas válidas de 06/10 a 12/10', today)).toEqual({ startDate: '2026-10-06', endDate: '2026-10-12', mode: 'date_range' })
    expect(parseLiteralValidityPeriod('30 de setembro a 2 de outubro', today)).toEqual({ startDate: '2026-09-30', endDate: '2026-10-02', mode: 'date_range' })
    expect(parseLiteralValidityPeriod('6 de outubro', today)).toEqual({ startDate: '2026-10-06', endDate: '2026-10-06', mode: 'single_day' })
    expect(parseLiteralValidityPeriod('05/01', new Date('2026-12-20T12:00:00-03:00'))).toEqual({ startDate: '2027-01-05', endDate: '2027-01-05', mode: 'single_day' })
    expect(parseLiteralValidityPeriod('sem validade', today)).toEqual({ mode: 'while_stocks' })
    expect(parseLiteralValidityPeriod('06, 08 e 10 de outubro', today)).toBeNull()
    expect(parseLiteralValidityPeriod('07/10 a 06/10', today)).toBeNull()
    expect(parseLiteralValidityPeriod('31/02', today)).toBeNull()
  })

  it('recusa cabeçalho que não consegue mostrar logo ou contatos do perfil', () => {
    const canvas = { objects: [
      { type: 'image', quickLogoSlot: true },
      { type: 'textbox', businessProfileField: 'whatsapp' },
      { type: 'textbox', businessProfileField: 'address' },
      { type: 'textbox', businessProfileField: 'instagram' }
    ] }
    expect(() => assertFlyerProfileBindings(canvas, profile, true)).not.toThrow()
    expect(() => assertFlyerProfileBindings(canvas, profile, false)).toThrow(/Cadastre a logo/)
    expect(() => assertFlyerProfileBindings({ objects: canvas.objects.slice(1) }, profile, true)).toThrow(/espaço editável para a logo/)
    const headerWithoutOptionalContacts = { objects: canvas.objects.slice(0, 2) }
    expect(() => assertFlyerProfileBindings(headerWithoutOptionalContacts, {
      ...profile, website: 'https://cliente-teste.example', facebook: '@cliente-teste'
    }, true)).not.toThrow()
    expect(() => assertFlyerProfileBindings({ objects: [canvas.objects[0]] }, profile, true)).toThrow(/telefone ou WhatsApp/)
  })

  it('bloqueia outra conta e dados/fotos de revisão antiga antes do render', () => {
    const current = order()
    expect(() => assertCanRender(current, otherId)).toThrowError(expect.objectContaining({ code: 'ACCOUNT_MISMATCH' }))
    const stale = updateOrder(current, userId, { validity: 'Sábado e domingo' })
    expect(() => assertCanRender(stale, userId)).toThrowError(expect.objectContaining({ code: 'DATA_NOT_APPROVED' }))
  })

  it('lê foto inbound aprovada pelo resolvedor de storage por conta e valida seu hash', async () => {
    const bytes = Buffer.from('approved image bytes')
    const hash = createHash('sha256').update(bytes).digest('hex')
    const key = `whatsapp-creation/${userId}/inbound/photo.png`
    const current = order(key, hash)
    const readOwnedBytes = async (candidateKey: string, accountId: string) => {
      expect(candidateKey).toBe(key)
      expect(accountId).toBe(userId)
      return bytes
    }
    const loaded = await approvedProductImages(current, userId, readOwnedBytes as any)
    expect(loaded.get('rice')?.bytes).toEqual(bytes)
    expect(loaded.get('rice')?.dataUrl).toContain('data:image/png;base64,')
  })

  it('aceita asset exato publicado e recusa prefixo privado de terceiro', () => {
    const publishedKey = `art-studio/${otherId}/asset.png`
    expect(isPublishedArtAssetStorageKey(publishedKey, { owner_id: otherId, storage_key: publishedKey }, otherId)).toBe(true)
    const privateKey = `art-studio/${otherId}/private.png`
    expect(isPublishedArtAssetStorageKey(privateKey, { owner_id: userId, storage_key: privateKey, shared: false }, otherId)).toBe(false)
    expect(isPublishedArtAssetStorageKey(publishedKey, { owner_id: otherId, storage_key: `art-studio/${otherId}/different.png` }, otherId)).toBe(false)
  })

  it('prepara prévia de cabeçalho com campos explicativos, sem preços de exemplo', () => {
    const composition = {
      version: 1, width: 1080, height: 1350, background: '#fff',
      layers: [
        { id: 'product_name', kind: 'text', name: 'Nome', x: 1, y: 1, width: 200, height: 50, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#111', text: 'Arroz da Loja' },
        { id: 'product_price', kind: 'text', name: 'Preço', x: 1, y: 60, width: 200, height: 50, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#111', text: 'R$ 9,99' },
        { id: 'brand-logo', kind: 'image', name: 'Logo', x: 1, y: 120, width: 100, height: 50, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#111', src: '/api/art-studio/brand-logo' }
      ]
    }
    const preview = fillHeaderPreviewPlaceholders(composition as any)
    expect(preview.layers[0]).toMatchObject({ text: 'Seu produto' })
    expect(preview.layers[1]).toMatchObject({ text: '', visible: false })
    expect(preview.layers[2]).toMatchObject({ kind: 'text', text: 'Sua logo', visible: true })
    expect(renderCreationHeaderPreview).toBeTypeOf('function')
  })

  it('resolve capa de vídeo apenas pelo manifest, chave e tipo de imagem publicados', () => {
    const key = 'video-studio/catalog/4963bd87bb2a6f29a0bcbe9206f2a3c2be409820430081e08a1527f25042cb49/templates/alerta-background.png'
    const header = { previewUrl: '/video-studio/templates/alerta-background.png', headerKey: key }
    expect(resolveVideoHeaderPreviewAsset(header)?.key).toBe(key)
    expect(resolveVideoHeaderPreviewAsset({ ...header, headerKey: 'video-studio/catalog/other' })).toBeNull()
    expect(resolveVideoHeaderPreviewAsset({ ...header, previewUrl: '/video-studio/templates/../../private.png' })).toBeNull()
  })

  it('deriva slots de uma zona grande e pagina grupos por departamento sem descartar itens', () => {
    const workerPath = `${process.cwd()}/workers/whatsapp-creation/render.py`
    const python = [
      'import importlib.util, sys, types',
      'playwright = types.ModuleType("playwright")',
      'sync_api = types.ModuleType("playwright.sync_api")',
      'sync_api.sync_playwright = lambda: None',
      'playwright.sync_api = sync_api',
      'sys.modules["playwright"] = playwright',
      'sys.modules["playwright.sync_api"] = sync_api',
      'spec = importlib.util.spec_from_file_location("creation_renderer", sys.argv[1])',
      'module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)',
      'logo = {"type":"image","name":"account-logo","quickLogoSlot":True,"_customId":"logo-1","left":621,"top":35,"width":398,"height":213,"scaleX":1.07,"scaleY":1.07}',
      'canvas = {"objects":[{"name":"background"},logo,{"name":"foreground-decoration"}]}',
      'module._promote_logo_slots(canvas)',
      'assert [item["name"] for item in canvas["objects"]] == ["background","foreground-decoration","account-logo"]',
      'assert canvas["objects"][-1] is logo and (logo["_customId"],logo["left"],logo["top"],logo["width"],logo["height"],logo["scaleX"],logo["scaleY"]) == ("logo-1",621,35,398,213,1.07,1.07)',
      'zone = {"left":540,"top":875,"width":994,"height":683,"originX":"center","originY":"center","scaleX":1,"scaleY":1}',
      'slots = module._zone_slots([zone], 9)',
      'assert len(slots) == 9 and len({(round(slot["left"],2),round(slot["top"],2)) for slot in slots}) == 9',
      'items = [{"id":str(i),"department":"Mercearia"} for i in range(10)]',
      'pages = module._product_groups(items, "department", len(slots))',
      'assert [len(group) for _,group in pages] == [9,1] and sum(len(group) for _,group in pages) == len(items)',
      'assert len(module._product_groups(items[:9], "single", len(slots))[0][1]) == 9'
    ].join('; ')
    execFileSync('python3', ['-c', python, workerPath], { stdio: 'pipe' })
  })

  it('divide os produtos em N páginas equilibradas na ordem da lista, respeitando o limite do Story', () => {
    const workerPath = `${process.cwd()}/workers/whatsapp-creation/render.py`
    const python = [
      'import importlib.util, sys, types',
      'playwright = types.ModuleType("playwright")',
      'sync_api = types.ModuleType("playwright.sync_api")',
      'sync_api.sync_playwright = lambda: None',
      'playwright.sync_api = sync_api',
      'sys.modules["playwright"] = playwright',
      'sys.modules["playwright.sync_api"] = sync_api',
      'spec = importlib.util.spec_from_file_location("creation_renderer", sys.argv[1])',
      'module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)',
      'items = [{"id":str(i)} for i in range(15)]',
      'pages = module._product_groups(items, "pages", 16, 2)',
      'assert [len(group) for _,group in pages] == [8,7], pages',
      'assert [item["id"] for _,group in pages for item in group] == [str(i) for i in range(15)]',
      'assert [len(group) for _,group in module._product_groups(items, "pages", 16, 3)] == [5,5,5]',
      'story = [{"id":str(i)} for i in range(20)]',
      'assert [len(group) for _,group in module._product_groups(story, "pages", 9, 2)] == [7,7,6]',
      'assert [len(group) for _,group in module._product_groups(items[:3], "pages", 16, 5)] == [1,1,1]',
      'assert [len(group) for _,group in module._product_groups(story, "pages", 9)] == [9,9,2]'
    ].join('; ')
    execFileSync('python3', ['-c', python, workerPath], { stdio: 'pipe' })
    // A conversa usa a mesma conta do worker para avisar o cliente antes de gerar.
    expect(splitPageSizes(15, 2, 16)).toEqual([8, 7])
    expect(splitPageSizes(20, 2, 9)).toEqual([7, 7, 6])
    expect(splitPageSizes(3, 5, 16)).toEqual([1, 1, 1])
  })

  it('aceita a quantidade de partes só com divisão em páginas e com ao menos um produto por parte', () => {
    const accountId = '11111111-1111-4111-8111-111111111111'
    const base = createOrder({
      id: '33333333-3333-4333-8333-333333333333', identity: { accountId, normalizedSender: '+5511999999999' }, kind: 'encarte', theme: 'Fecha Mês',
      formats: [{ id: 'feed', width: 1080, height: 1350 }], division: 'pages', pageCount: 2,
      products: [1, 2, 3].map(index => ({ id: `item-${index}`, name: `Produto ${index}`, brand: '', variant: '', weight: '', price: 'R$ 1,99' }))
    })
    expect(base.pageCount).toBe(2)
    expect(() => updateOrder(base, accountId, { division: 'single' })).toThrow(/divisão por páginas/)
    expect(updateOrder(base, accountId, { division: 'single', pageCount: null }).pageCount).toBeNull()
    expect(() => updateOrder(base, accountId, { pageCount: 1 })).toThrow(/entre 2 e/)
  })

  it.skipIf(!pythonWithPlaywright)('carrega Barlow, Inter e Fira Sans originais no Chromium antes do render', () => {
    const workerPath = `${process.cwd()}/workers/whatsapp-creation/render.py`
    const python = [
      'import importlib.util, json, sys',
      'from playwright.sync_api import sync_playwright',
      'spec = importlib.util.spec_from_file_location("creation_renderer", sys.argv[1])',
      'module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)',
      'css, faces = module._font_stylesheet({"objects":[{"fontFamily":"Barlow"},{"fontFamily":"Inter"},{"fontFamily":"Fira Sans"}]})',
      'with sync_playwright() as playwright:',
      ' browser = playwright.chromium.launch(headless=True, executable_path=__import__("os").environ.get("WHATSAPP_CREATION_CHROMIUM_EXECUTABLE"), args=["--no-sandbox", "--disable-dev-shm-usage"])',
      ' page = browser.new_page()',
      ' page.set_content("<!doctype html><style>" + css + "</style><canvas></canvas>", wait_until="load")',
      ' metrics = page.evaluate("""async faces => { const loaded = await Promise.all([document.fonts.load(\'700 32px "Barlow"\', \'Font check 123\'), document.fonts.load(\'700 32px "Inter"\', \'Font check 123\')]); await document.fonts.ready; const ctx = document.querySelector(\'canvas\').getContext(\'2d\'); const widths = {}; for (const family of [\'Barlow\', \'Inter\', \'serif\']) { ctx.font = `700 32px "${family}"`; widths[family] = ctx.measureText(\'Font check 123\').width; } return {loaded: loaded.map(fonts => fonts.length), checks: [document.fonts.check(\'700 32px "Barlow"\', \'Font check 123\'), document.fonts.check(\'700 32px "Inter"\', \'Font check 123\')], widths}; }""", faces)',
      ' italic = page.evaluate("""async () => { const faces = await document.fonts.load(\'italic 900 40px "Barlow"\', \'4,99\'); return faces.map(face => ({style: face.style, weight: face.weight, status: face.status})); }""")',
      ' assert italic == [{"style":"italic", "weight":"900", "status":"loaded"}], italic',
      ' fira = page.evaluate("""async () => { const faces = await document.fonts.load(\'italic 900 40px "Fira Sans"\', \'4,99\'); return faces.map(face => ({style: face.style, weight: face.weight, status: face.status})); }""")',
      ' assert fira == [{"style":"italic", "weight":"900", "status":"loaded"}], fira',
      ' assert metrics["loaded"] == [1, 1] and metrics["checks"] == [True, True], metrics',
      ' assert metrics["widths"]["Barlow"] > 0 and metrics["widths"]["Inter"] > 0, metrics',
      ' assert metrics["widths"]["Barlow"] != metrics["widths"]["serif"] and metrics["widths"]["Inter"] != metrics["widths"]["serif"], metrics',
      ' browser.close()'
    ].join('\n')
    execFileSync('python3', ['-c', python, workerPath], { stdio: 'pipe' })
  }, 30_000)

  it('mantém o contorno sticker da logo também no PNG da oferta completa', async () => {
    const redLogo = await sharp({ create: { width: 100, height: 70, channels: 4, background: '#00000000' } })
      .composite([{ input: Buffer.from('<svg width="100" height="70"><rect x="10" y="10" width="80" height="50" fill="#cc0000"/></svg>') }])
      .png().toBuffer()
    const logoData = `data:image/png;base64,${redLogo.toString('base64')}`
    const base = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#228833' } }).png().toBuffer()
    const canvas = { version: '7.1.0', width: 400, height: 300, objects: [{
      type: 'Image', name: 'header-logo-slot', src: logoData, quickLogoSlot: true, quickLogoSource: logoData,
      left: 200, top: 100, originX: 'center', originY: 'center', width: 100, height: 70, scaleX: 1, scaleY: 1,
      __stickerOutlineEnabled: true, __stickerOutlineColor: '#FFFFFF', __stickerOutlineWidth: 4,
      __stickerOutlineOpacity: 1, __stickerOutlineMode: 'outside'
    }] }
    const result = await applyFlyerLogoStickers(base, canvas)
    const outside = await sharp(result).extract({ left: 20, top: 20, width: 1, height: 1 }).raw().toBuffer()
    expect([...outside.subarray(0, 3)]).toEqual([34, 136, 51])
    const { data, info } = await sharp(result).extract({ left: 145, top: 60, width: 110, height: 80 }).raw().toBuffer({ resolveWithObject: true })
    let white = 0
    for (let i = 0; i < data.length; i += info.channels) if (data[i]! > 240 && data[i + 1]! > 240 && data[i + 2]! > 240) white++
    expect(white).toBeGreaterThan(0)
  })

  it.skipIf(!pythonWithPlaywright)('preenche a estrutura 2 por 2 com cartões e etiquetas nativas editáveis', async () => {
    const label = { type: 'Group', version: '7.1.0', name: 'priceGroup', left: 0, top: 0, originX: 'center', originY: 'center', objects: [
      { type: 'Rect', version: '7.1.0', name: 'price_bg', left: 0, top: 0, originX: 'center', originY: 'center', width: 160, height: 60, fill: '#111111' },
      { type: 'Text', version: '7.1.0', name: 'price_currency_text', text: 'R$', left: -55, top: 0, originX: 'center', originY: 'center', fontSize: 22, fill: '#ffff00' },
      { type: 'IText', version: '7.1.0', name: 'price_value_text', text: '22,99', left: 10, top: 0, originX: 'center', originY: 'center', fontSize: 38, fill: '#ffffff' }
    ] }
    const canvas = {
      version: '7.1.0', width: 1080, height: 1920, background: '#fff',
      __labelTemplates: [{ id: 'tpl_default', name: 'Padrão', group: label }],
      objects: [
        { type: 'Group', left: 540, top: 880, originX: 'center', originY: 'center', width: 900, height: 1600,
          objects: [{ type: 'Rect', left: 0, top: 0, originX: 'center', originY: 'center', width: 900, height: 1600, fill: 'transparent' }],
          isProductZone: true, isGridZone: true, _customId: 'zone-1', name: 'productZone',
          _zoneGlobalStyles: { cardColorMode: 'auto', templateProductPalette: { cardColor: '#fbfff4', prodNameColor: '#244525' } },
          structureByProductCountByPreviewFormat: { story: { '4': { columns: 2, rows: 2, padding: 8, gapHorizontal: 8, gapVertical: 8 } } } },
        { type: 'Rect', left: 0, top: 0, width: 1080, height: 1920, fill: 'transparent', isFrame: true, _customId: 'frame-1', name: 'frameRoot' }
      ]
    }
    const productImage = `data:image/png;base64,${(await sharp({ create: { width: 80, height: 120, channels: 4, background: '#60a533' } }).png().toBuffer()).toString('base64')}`
    const product = (id: string, price: string) => ({
      id, name: `Produto ${id}`, brand: 'Marca', variant: 'Variante', weight: '5 kg', price,
      imageDataUrl: productImage
    })
    const pages = await renderEditableFlyerCanvas({ canvas, products: [product('one', 'R$ 19,90'), product('two', 'R$ 29,90'), product('three', 'R$ 39,90'), product('four', 'R$ 49,90')], division: 'single', formatId: 'stories' })
    expect(pages).toHaveLength(1)
    const rendered = pages[0]!.png
    expect(rendered.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect([rendered.readUInt32BE(16), rendered.readUInt32BE(20)]).toEqual([1080, 1920])
    const objects = pages[0]!.canvas.objects
    const cards = objects.filter((item: any) => item.name === 'product-card')
    expect(cards).toHaveLength(4)
    expect(cards[0].left).toBeLessThan(cards[1].left)
    expect(cards[0].top).toBeLessThan(cards[2].top)
    expect(cards[1].top).toBeCloseTo(cards[0].top)
    expect(cards[2].left).toBeCloseTo(cards[0].left)
    expect(cards[0].objects.find((item: any) => item.name === 'offerBackground')?.fill).toBe('#fbfff4')
    const nativeLabel = cards[0].objects.find((item: any) => item.name === 'priceGroup')
    expect(nativeLabel.objects.find((item: any) => item.name === 'price_value_text')?.text).toBe('19,90')
    expect(cards[0].objects.some((item: any) => item.name === 'smart_title' && item.text?.includes('Produto one'))).toBe(true)
    expect(pages[0]!.canvas.__labelTemplates).toHaveLength(1)
    expect(objects.some((item: any) => item.isProductZone === true && item.name === 'productZone')).toBe(true)
    expect(cards[0]).toMatchObject({ isProductCard: true, isSmartObject: true, productItemId: 'one', productZoneId: 'zone-1' })
    expect(objects.some((item: any) => item.isFrame === true && item._customId === 'frame-1')).toBe(true)

    // A importação manual do Editor Rápido já nasce com preenchimento
    // automático de imagens e com a receita de Cards da conta.
    const wideImage = `data:image/png;base64,${(await sharp({ create: { width: 600, height: 200, channels: 4, background: '#60a533' } }).png().toBuffer()).toString('base64')}`
    const accountCardLayout = createDefaultProductCardConfiguration()
    accountCardLayout.profiles!.featured.elements.image.width = 30
    const accountCanvas = JSON.parse(JSON.stringify(canvas))
    const accountLabel = JSON.parse(JSON.stringify(label))
    accountLabel.objects[0].fill = '#345678'
    // A etiqueta salva tem dois dígitos; um preço com um dígito precisa
    // reindexar a vírgula/centavos e manter o offset autorado no Mini Editor.
    Object.assign(accountLabel.objects[2], {
      __priceRichText: true, fontFamily: 'Barlow', fontStyle: 'italic', fontWeight: 900,
      __priceRichIntegerStyle: { fontSize: 38, fontFamily: 'Barlow', fontStyle: 'italic', fontWeight: 900 },
      __priceRichDecimalStyle: { fontSize: 19, fontFamily: 'Barlow', fontStyle: 'italic', fontWeight: 900 },
      __priceRichIntegerScale: 1, __priceRichDecimalScale: 0.5,
      __priceRichDecimalOffsetX: 0.75, __priceRichDecimalOffsetY: -14,
      styles: [
        { start: 0, end: 2, style: { fontSize: 38 } },
        { start: 2, end: 5, style: { fontSize: 19 } }
      ]
    })
    applyFlyerAccountLabelTemplates(accountCanvas, [{ id: 'tpl_default', name: 'Padrão da conta', group: accountLabel }])
    const manualPages = await renderEditableFlyerCanvas({
      canvas: accountCanvas,
      products: [product('one', 'R$ 4,99'), product('two', 'R$ 22,99'), product('three', 'R$ 5,99'), product('four', 'R$ 4,99')]
        .map(item => ({ ...item, imageDataUrl: wideImage })),
      division: 'single', formatId: 'stories', cardLayout: accountCardLayout
    })
    const manualCards = manualPages[0]!.canvas.objects.filter((item: any) => item.name === 'product-card')
    const rich = manualCards[0].objects.find((item: any) => item.name === 'priceGroup').objects
      .find((item: any) => item.name === 'price_value_text')
    expect(rich.text).toBe('4,99')
    expect(rich.__priceRichDecimalOffsetY).toBe(-14)
    expect(rich.styles.find((span: any) => span.start === 1)).toMatchObject({ end: 4, style: { fontSize: 19 } })
    expect(manualCards.map((item: any) => item.productItemId)).toEqual(['one', 'two', 'three', 'four'])
    expect(manualCards.every((item: any) => item.__cardLabelTemplateId === 'tpl_default')).toBe(true)
    expect(manualCards.every((item: any) => item.objects.filter((child: any) => /^(smart_image|extra_image_)/.test(child.name)).length >= 2)).toBe(true)
    for (const card of manualCards) {
      expect(card._productData.imageFillCount).toBeUndefined()
      expect(card._productData.imageFillMinimum).toBe(2)
      const recipe = resolveProductCardConfigurationProfile(accountCardLayout, card._cardWidth, card._cardHeight).elements
      const images = card.objects.filter((item: any) => /^(smart_image|extra_image_)/.test(item.name))
      expect((images[0].left + images.at(-1).left) / 2).toBeCloseTo((recipe.image.x / 100 - 0.5) * card._cardWidth, 2)
      expect((images[0].top + images.at(-1).top) / 2).toBeCloseTo((recipe.image.y / 100 - 0.5) * card._cardHeight, 2)
      expect(card.objects.find((item: any) => item.name === 'smart_title').left)
        .toBeCloseTo((recipe.name.x / 100 - 0.5) * card._cardWidth, 2)

      expect(card.objects.find((item: any) => item.name === 'smart_image').width *
        card.objects.find((item: any) => item.name === 'smart_image').scaleX).toBeLessThan(card._cardWidth * 0.31)
      expect(card.width).toBeLessThan(card._cardWidth * 1.05)
      expect(card.height).toBeLessThan(card._cardHeight * 1.05)
      expect(card.objects.filter((item: any) => item.name === 'priceGroup')).toHaveLength(1)
      expect(card.objects.find((item: any) => item.name === 'priceGroup')?.objects.find((item: any) => item.name === 'price_bg')?.fill).toBe('#345678')
    }

    const many = Array.from({ length: 10 }, (_, index) => product(String(index), 'R$ 19,90'))
    const split = await renderEditableFlyerCanvas({ canvas, products: many, division: 'pages', formatId: 'stories' })
    expect(split).toHaveLength(2)
    expect(split.map((page) => page.productIds)).toEqual([many.slice(0, 9).map(item => item.id), ['9']])
    await expect(renderEditableFlyerCanvas({ canvas, products: many, division: 'single', formatId: 'stories' })).rejects.toThrow(/prévia editável/)
  }, 100_000)
})

 describe('bandeiras nativas dos modelos', () => {
  it('carrega a bandeira real e rejeita caminhos fora do catálogo', async () => {
    const image = await readFlyerPaymentIcon('/cartoes/cartao-82.png')
    expect(image?.subarray(1, 4).toString()).toBe('PNG')
    for (const path of ['/cartoes/../../.env', '/cartoes/cartao-82.png/../secret', '/cartoes/%2e%2e/.env', 'https://example.com/cartoes/cartao-82.png']) {
      expect(await readFlyerPaymentIcon(path)).toBeNull()
    }
  })
})

it('aceita somente o fundo exato publicado na coleção de encartes', () => {
  const key = 'video-studio/catalog/0220c187da0bf6ff9642ff4b0c6c78f7edda06d0164f5e5690b919508f582761/templates/catalog/reference-20261004-01.png'
  expect(resolvePublishedFlyerCatalogKey('/api/storage/p?key=' + encodeURIComponent(key))).toBe(key)
  expect(resolvePublishedFlyerCatalogKey('/api/storage/p?key=video-studio/private/secret.png')).toBeNull()
  expect(resolvePublishedFlyerCatalogKey('/api/storage/p?key=' + encodeURIComponent(key.replace('0220', 'abcd')))).toBeNull()
})

describe('personalização do encarte no render', () => {
  it('WhatsApp e endereço pedidos valem só na cópia do perfil usada no encarte', () => {
    const copy = applyBusinessOverrides(profile, { whatsapp: '(11) 98888-7777', address: 'Av. Nova, 200' })
    expect(copy).not.toBe(profile)
    expect(copy).toMatchObject({ whatsapp: '(11) 98888-7777', address: 'Av. Nova, 200' })
    expect(copy.whatsappNumbers).toEqual([{ id: 'main', label: '', value: '(11) 98888-7777' }])
    expect(copy.addresses).toEqual([{ id: 'main', label: '', value: 'Av. Nova, 200' }])
    expect(profile.whatsapp).toBe('+5511999999999')
    expect(applyBusinessOverrides(profile, undefined)).toBe(profile)
    const canvas = { objects: [
      { type: 'textbox', businessProfileField: 'whatsapp', text: 'Número antigo', visible: true },
      { type: 'textbox', businessProfileField: 'address', text: 'Endereço antigo', visible: true }
    ] }
    hydrateFlyerBusinessFields(canvas, copy, '')
    expect(canvas.objects[0]).toMatchObject({ text: '(11) 98888-7777' })
    expect(canvas.objects[1]).toMatchObject({ text: 'Av. Nova, 200' })
  })

  it('o telefone acompanha o WhatsApp só quando era o mesmo número', () => {
    expect(applyBusinessOverrides({ ...profile, phone: '' }, { whatsapp: '(11) 98888-7777' }).phone).toBe('(11) 98888-7777')
    expect(applyBusinessOverrides({ ...profile, phone: '1133334444' }, { whatsapp: '(11) 98888-7777' }).phone).toBe('1133334444')
  })

  it('data por extenso ou numérica no layout dividido e no texto simples', () => {
    const split = () => ({ objects: [{ type: 'textbox', name: 'header-validity', quickDataField: 'validity', quickValidityLayout: 'inline-footer', quickValidityWhileStocks: true, quickValidityDateFormat: 'numeric', text: 'x', visible: true }] })
    const validity = { validity: '06 e 07 de outubro de 2026', conditions: '' }
    const long = hydrateFlyerBusinessFields(split(), profile, '', validity, { dateFormat: 'long' })
    expect(long.objects[0]).toMatchObject({ text: 'OFERTA VÁLIDA DE 6 A 7 DE OUTUBRO OU ENQUANTO DURAREM OS ESTOQUES', quickValidityDateFormat: 'long' })
    const numeric = hydrateFlyerBusinessFields(split(), profile, '', validity)
    expect(numeric.objects[0]).toMatchObject({ text: 'OFERTA VÁLIDA DE 06/10/2026 A 07/10/2026 OU ENQUANTO DURAREM OS ESTOQUES' })
    const simple = (format?: 'long' | 'numeric') => hydrateFlyerBusinessFields({ objects: [{ type: 'textbox', name: 'header-validity', text: 'x', visible: true }] }, profile, '', validity, { dateFormat: format }).objects[0].text
    expect(simple('long')).toBe('Ofertas válidas de 6 a 7 de outubro')
    expect(simple('numeric')).toBe('Ofertas válidas de 06/10/2026 a 07/10/2026')
    expect(simple()).toBe('06 e 07 de outubro de 2026')
  })

  it('sem datas reconhecidas mantém o texto literal do cliente', () => {
    expect(formatSimpleValidityText('esta semana', parseLiteralValidityPeriod('esta semana'), 'long')).toBe('esta semana')
    expect(formatSimpleValidityText('sem validade', parseLiteralValidityPeriod('sem validade'), 'long')).toBe('sem validade')
  })

  it('o worker carrega as fontes das etiquetas escolhidas por produto', () => {
    const python = [
      'import importlib.util, sys, types',
      'playwright = types.ModuleType("playwright"); sync_api = types.ModuleType("playwright.sync_api"); sync_api.sync_playwright = lambda: None',
      'sys.modules["playwright"] = playwright; sys.modules["playwright.sync_api"] = sync_api',
      'spec = importlib.util.spec_from_file_location("creation_renderer", sys.argv[1])',
      'module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)',
      'canvas = {"objects": [], "__labelTemplates": [{"id": "etq", "group": {"objects": [{"fontFamily": "Oswald"}]}}, {"id": "outra", "group": {"objects": [{"fontFamily": "Anton"}]}}]}',
      'assert "oswald" not in module._requested_font_families(canvas)',
      'assert "oswald" in module._requested_font_families(canvas, ["etq"])',
      'assert "anton" not in module._requested_font_families(canvas, ["etq"])'
    ].join('\n')
    execFileSync('python3', ['-c', python, `${process.cwd()}/workers/whatsapp-creation/render.py`], { stdio: 'pipe' })
  })
})
