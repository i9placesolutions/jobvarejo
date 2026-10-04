import { describe, expect, it } from 'vitest'
import {
  approveData,
  approveImage,
  assertCanRender,
  createOrder,
  setImageCandidates,
  updateOrder
} from '../../shared/whatsapp-creation'
import {
  deterministicUuid,
  flyerTemplateRevision,
  flyerThemeMatchesOrder,
  flyerDivisionSupportsProductCount,
  assertFlyerProfileBindings,
  hydrateFlyerBusinessFields,
  renderEditableFlyerCanvas,
  applyFlyerLogoStickers,
  approvedProductImages,
  isPublishedArtAssetStorageKey,
  fillHeaderPreviewPlaceholders,
  renderCreationHeaderPreview,
  resolveVideoHeaderPreviewAsset
} from '../../server/utils/whatsapp-creation/render'
import { flyerHeaderCropHeight, flyerHeaderLogoBox } from '../../server/utils/whatsapp-creation/header-preview'
import type { BusinessProfile } from '../../utils/businessProfile'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const pythonWithPlaywright = (() => {
  try {
    execFileSync(process.env.PRODUCT_IMAGE_PYTHON || 'python3', ['-c', 'from pathlib import Path; from playwright.sync_api import sync_playwright; p=sync_playwright().start(); assert Path(p.chromium.executable_path).is_file(); p.stop()'], { stdio: 'ignore' })
    return true
  } catch { return false }
})()

const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const orderId = '33333333-3333-4333-8333-333333333333'

const profile = {
  companyName: 'Mercado Central', logo: '', phone: '11999999999', whatsapp: '+5511999999999',
  whatsappNumbers: [], address: 'Rua Central, 10', addresses: [], instagram: '@mercadocentral',
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

function pngDataUrl(): string {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgT8AAAAASUVORK5CYII='
}

describe('adapter de render da criação WhatsApp', () => {
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
      { type: 'Image', quickLogoSlot: true, src: 'imagens/logo-dono.png', visible: true },
      { type: 'image', quickLogoBackdrop: true, visible: true }
    ] }
    hydrateFlyerBusinessFields(canvas, profile, 'data:image/png;base64,YQ==')
    expect(canvas.objects[0]).toMatchObject({ text: 'Mercado Central', visible: true })
    expect(canvas.objects[1]).toMatchObject({ text: 'Rua Central, 10', visible: true })
    expect(canvas.objects[2]).toMatchObject({ src: 'data:image/png;base64,YQ==', visible: true })

    const noLogo = hydrateFlyerBusinessFields(JSON.parse(JSON.stringify(canvas)), profile, '')
    expect(noLogo.objects[2]).toMatchObject({ src: '', visible: false })
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

  it.skipIf(!pythonWithPlaywright)('usa Chromium e Fabric para gerar PNG real com nome e preço editáveis e respeita páginas', async () => {
    const canvas = {
      version: '7.1.0', width: 1080, height: 1920, background: '#fff',
      objects: [
        { type: 'rect', left: 80, top: 80, width: 900, height: 1600, fill: '#fff', isProductZone: true, _customId: 'zone-1', name: 'productZone' },
        { type: 'rect', left: 0, top: 0, width: 1080, height: 1920, fill: 'transparent', isFrame: true, _customId: 'frame-1', name: 'frameRoot' }
      ]
    }
    const product = (id: string, price: string) => ({
      id, name: `Produto ${id}`, brand: 'Marca', variant: 'Variante', weight: '5 kg', price,
      imageDataUrl: pngDataUrl()
    })
    const pages = await renderEditableFlyerCanvas({ canvas, products: [product('one', 'R$ 19,90')], division: 'single', formatId: 'stories' })
    expect(pages).toHaveLength(1)
    const rendered = pages[0]!.png
    expect(rendered.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect([rendered.readUInt32BE(16), rendered.readUInt32BE(20)]).toEqual([1080, 1920])
    const objects = pages[0]!.canvas.objects
    expect(objects.some((item: any) => item.name === 'product-name-one' && item.text?.includes('Produto one'))).toBe(true)
    expect(objects.some((item: any) => item.name === 'product-price-one' && item.text === 'R$ 19,90')).toBe(true)
    expect(objects.some((item: any) => item.isProductZone === true && item.name === 'productZone')).toBe(true)
    expect(objects.some((item: any) => item.isProductCard === true && item.productItemId === 'one' && item.productZoneId === 'zone-1')).toBe(true)
    expect(objects.some((item: any) => item.isFrame === true && item._customId === 'frame-1')).toBe(true)

    const split = await renderEditableFlyerCanvas({ canvas, products: [product('one', 'R$ 19,90'), product('two', 'R$ 29,90')], division: 'pages', formatId: 'stories' })
    expect(split).toHaveLength(2)
    expect(split.map((page) => page.productIds)).toEqual([['one'], ['two']])
    await expect(renderEditableFlyerCanvas({ canvas, products: [product('one', 'R$ 19,90'), product('two', 'R$ 29,90')], division: 'single', formatId: 'stories' })).rejects.toThrow(/comporta/)
  }, 100_000)
})
