import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { REDESIGN_VERSION } from '../../shared/pageEnhancementVersion'
import { getS3Client } from './s3'
import { pgOneOrNull, pgTx } from './postgres'

export const ENHANCEMENT_MODELS = ['openai/gpt-image-2.5-sunburst', 'openai/gpt-image-2.5-flare']
export const enhancementAspectRatio = (width: number, height: number) => {
  const ratio = width / height
  const supported = [
    ['1:1', 1], ['3:2', 3 / 2], ['2:3', 2 / 3], ['4:3', 4 / 3],
    ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16], ['21:9', 21 / 9]
  ] as const
  const closest = supported.reduce((best, current) => Math.abs(current[1] - ratio) < Math.abs(best[1] - ratio) ? current : best)
  return Math.abs(closest[1] - ratio) / ratio < 0.025 ? closest[0] : 'auto'
}
export const ENHANCEMENT_PROMPT = `Refine o acabamento visual deste encarte de supermercado sem mudar sua composição. Melhore exclusivamente fundos, texturas, efeitos decorativos, profundidade e harmonia visual. Preserve rigorosamente posições, proporções e paleta. NÃO adicione, reescreva, mova ou remova textos, preços, datas, contatos, marcas, logotipos, embalagens ou produtos. Não invente produtos nem ofertas. Não adicione letras ou números. A segunda imagem é a máscara: áreas brancas são protegidas e devem permanecer intocadas; trabalhe somente nas áreas pretas. Produza uma única página completa no mesmo enquadramento da referência. As áreas protegidas serão recompostas a partir da imagem original pelo sistema.`
export const REDESIGN_PROMPT = `Edite a imagem enviada: ela é o encarte original e deve continuar sendo o mesmo encarte depois da melhoria. Faça uma melhoria visual profissional da página inteira, com fundo mais rico, iluminação, textura, profundidade, contraste e acabamento dos elementos gráficos. Melhore a apresentação dos cards, faixas, molduras e etiquetas sem reconstruir a montagem.

RESTRIÇÃO ABSOLUTA: mantenha exatamente a mesma quantidade de produtos, os mesmos produtos e fotografias, na mesma ordem, no mesmo grid, nas mesmas células e posições. Preserve logotipo, selo, nomes, marcas, embalagens, preços, unidades, datas, validade, contatos e todas as palavras e números. Não apague, acrescente, substitua, duplique, recorte nem desloque qualquer item comercial. Não crie um segundo grid ou produtos de fundo. Mantenha o enquadramento e a proporção da imagem original. A melhoria deve ser imediatamente perceptível no DESIGN, sem alterar o conteúdo nem a montagem. Produza uma única imagem final completa.`
type RedesignArea = { left: number; top: number; width: number; height: number }
export const compositeCommercialOverlay = async (generated: Buffer, overlay: Buffer, width: number, height: number, original?: Buffer, redesignArea?: RedesignArea) => {
  const metadata = await sharp(overlay, { limitInputPixels: 16_000_000 }).metadata()
  if (metadata.width !== width || metadata.height !== height || !metadata.hasAlpha) throw createError({ statusCode: 400, statusMessage: 'Camada comercial inválida.' })
  const candidate = await sharp(generated, { limitInputPixels: 24_000_000 }).resize(width, height, { fit: 'fill' }).ensureAlpha().png().toBuffer()
  if (!original || !redesignArea) return sharp(candidate).composite([{ input: overlay, blend: 'over' }]).png().toBuffer()
  const source = await sharp(original, { limitInputPixels: 16_000_000 }).metadata()
  if (source.width !== width || source.height !== height) throw createError({ statusCode: 400, statusMessage: 'Página original incompatível.' })
  // O redesign gerado compõe a página inteira. A camada comercial, criada a
  // partir dos objetos Fabric originais, fixa cada foto, nome, preço e marca.
  return sharp(candidate).composite([{ input: overlay, left: 0, top: 0, blend: 'over' }]).png().toBuffer()
}
export type EnhancementReceipt = { pipelineVersion?: string; redesignArea?: RedesignArea; mode?: 'finish'|'redesign'; id: string; sourceHash: string; projectId: string; pageId: string; model: string; quality: string; width: number; height: number; status: 'processing'|'completed'|'failed'|'uncertain'; costUsd: number|null; createdAt: string; updatedAt: string; originalKey: string; resultKey?: string; error?: string; usage?: Record<string, unknown> }
const bucket = () => String(useRuntimeConfig().wasabiBucket || process.env.WASABI_BUCKET || '')
const prefix = (userId: string, projectId: string) => `projects/${userId}/${projectId}/enhancements/`
const path = (userId: string, projectId: string, id: string) => `${prefix(userId, projectId)}${id}/receipt.json`
export const enhancementApiKey = () => String(process.env.OPENROUTER_API_KEY || process.env.NUXT_OPENROUTER_API_KEY || '').trim()
let enhancementModelCache: { checkedAt: number; models: string[] } | null = null
export const getAvailableEnhancementModels = async () => {
  if (enhancementModelCache && Date.now() - enhancementModelCache.checkedAt < 5 * 60_000) return enhancementModelCache.models
  const checked = await Promise.all(ENHANCEMENT_MODELS.map(async id => {
    try {
      const response = await fetch(`https://openrouter.ai/api/v1/images/models/${id}/endpoints`, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) return null
      const data = await response.json() as any
      return Array.isArray(data.endpoints) && data.endpoints.some((endpoint: any) => {
        const parameters = endpoint.supported_parameters || {}
        return parameters.input_references?.max >= 1
          && parameters.quality?.values?.includes('high')
          && parameters.aspect_ratio?.values?.includes('auto')
      }) ? id : null
    } catch { return null }
  }))
  const models = checked.filter((id): id is string => !!id)
  enhancementModelCache = { checkedAt: Date.now(), models }
  return models
}
export const assertEnhancementProject = async (userId: string, projectId: unknown, pageId?: unknown) => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(projectId || ''))) throw createError({ statusCode: 400, statusMessage: 'Projeto inválido.' })
  const project = await pgOneOrNull<{ canvas_data: any }>('SELECT canvas_data FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId])
  if (!project) throw createError({ statusCode: 404, statusMessage: 'Projeto não encontrado.' })
  if (pageId && !(Array.isArray(project.canvas_data) && project.canvas_data.some((p: any) => p.id === pageId))) throw createError({ statusCode: 400, statusMessage: 'Página não pertence ao projeto salvo. Salve o encarte antes de continuar.' })
}
const put = async (Key: string, Body: Buffer|string, ContentType: string) => { await getS3Client().send(new PutObjectCommand({ Bucket: bucket(), Key, Body, ContentType })) }
export const readEnhancement = async (userId: string, projectId: string, id: string): Promise<EnhancementReceipt|null> => {
  if (!/^[a-f0-9]{32}$/.test(id)) throw createError({statusCode:400,statusMessage:'Teste inválido.'})
  try { const r = await getS3Client().send(new GetObjectCommand({Bucket:bucket(),Key:path(userId,projectId,id)})); return JSON.parse(await r.Body!.transformToString()) }
  catch (e: any) { if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NoSuchKey') return null; throw e }
}
const writeReceipt = async (userId: string, r: EnhancementReceipt) => { r.updatedAt = new Date().toISOString(); await put(path(userId,r.projectId,r.id),JSON.stringify(r),'application/json') }
export const publicReceipt = (r: EnhancementReceipt) => {
  const expired = r.status === 'processing' && Date.now()-Date.parse(r.updatedAt)>7*60_000
  const status = expired ? 'uncertain' : r.status
  return {
    id: r.id,
    projectId: r.projectId,
    pageId: r.pageId,
    mode: r.mode,
    pipelineVersion: r.pipelineVersion,
    quality: r.quality,
    width: r.width,
    height: r.height,
    status,
    sourceHash: r.sourceHash,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    error: status === 'uncertain'
      ? 'Esta melhoria não foi confirmada. Consulte o histórico antes de tentar novamente. As páginas concluídas continuam disponíveis.'
      : status === 'failed'
        ? 'Não foi possível concluir esta melhoria. Você pode tentar novamente.'
        : undefined,
    originalUrl: '/api/storage/p?key='+encodeURIComponent(r.originalKey),
    resultUrl: r.resultKey ? '/api/storage/p?key='+encodeURIComponent(r.resultKey) : undefined
  }
}
export const listEnhancements = async (userId: string, projectId: string) => {
  const keys: string[] = []; let token: string|undefined
  do { const r = await getS3Client().send(new ListObjectsV2Command({Bucket:bucket(),Prefix:prefix(userId,projectId),ContinuationToken:token})); for(const o of r.Contents||[])if(o.Key?.endsWith('/receipt.json'))keys.push(o.Key.split('/').at(-2)!); token=r.NextContinuationToken } while(token)
  const items: EnhancementReceipt[]=[]
  for(let i=0;i<keys.length;i+=8){const batch=await Promise.all(keys.slice(i,i+8).map(id=>readEnhancement(userId,projectId,id)));items.push(...batch.filter((r):r is EnhancementReceipt=>!!r))}
  return items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(publicReceipt)
}
export const decodePagePng = (value: unknown) => {
  if(typeof value!=='string'||value.length>24_000_000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))throw createError({statusCode:400,statusMessage:'A página deve ser uma imagem PNG de até 18 MB.'})
  const bytes = Buffer.from(value.slice(value.indexOf(',')+1),'base64')
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw createError({statusCode:400,statusMessage:'Arquivo PNG inválido.'})
  return bytes
}
export const compositeProtectedPixels = async (original: Buffer, generated: Buffer, mask: Buffer) => {
  const source = await sharp(original,{limitInputPixels:16_000_000}).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const {width,height}=source.info
  const candidate=await sharp(generated,{limitInputPixels:24_000_000}).resize(width,height,{fit:'fill'}).ensureAlpha().raw().toBuffer()
  const protection=await sharp(mask,{limitInputPixels:16_000_000}).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true})
  if(protection.info.width!==width||protection.info.height!==height)throw new Error('mask_dimension_mismatch')
  let protectedPixels=0
  for(let p=0;p<width*height;p++){if(protection.data[p]!>=128){source.data.copy(candidate,p*4,p*4,p*4+4);protectedPixels++}}
  return {buffer:await sharp(candidate,{raw:{width,height,channels:4}}).png().toBuffer(),protectedPixels,width,height}
}
export const finalizeEnhancementImage = async (mode: 'finish' | 'redesign', original: Buffer, generated: Buffer, mask: Buffer, width: number, height: number) =>
  mode === 'redesign'
    ? sharp(generated, { limitInputPixels: 24_000_000 }).resize(width, height, { fit: 'fill' }).png().toBuffer()
    : (await compositeProtectedPixels(original, generated, mask)).buffer
export const startEnhancement = async (userId: string, body: any) => {
  const {projectId,pageId,quality}=body || {}
  await assertEnhancementProject(userId,projectId,pageId)
  if(!enhancementApiKey())throw createError({statusCode:503,statusMessage:'A melhoria com IA está indisponível no momento. Tente novamente mais tarde.'})
  if(!['medium','high'].includes(quality))throw createError({statusCode:400,statusMessage:'Qualidade inválida.'})
  // Modelo e provedor são escolhidos no servidor conforme a disponibilidade.
  // A tela consulta a disponibilidade ao abrir; chamadas sem essa consulta usam
  // o modelo padrão da lista privada, sem aceitar escolha enviada pelo cliente.
  const cacheIsFresh = !!enhancementModelCache && Date.now() - enhancementModelCache.checkedAt < 5 * 60_000
  const model = cacheIsFresh ? (enhancementModelCache?.models[0] || null) : ENHANCEMENT_MODELS[0]
  if(!model)throw createError({statusCode:503,statusMessage:'A melhoria com IA está indisponível no momento. Tente novamente mais tarde.'})
  const mode = body.mode === undefined ? 'finish' : body.mode
  if (!['finish', 'redesign'].includes(mode)) throw createError({statusCode:400,statusMessage:'Modo de melhoria inválido.'})
  const original=decodePagePng(body.original),mask=decodePagePng(body.mask)
  if (mode === 'redesign' && body.pipelineVersion !== REDESIGN_VERSION) throw createError({statusCode:409,statusMessage:'Atualize o editor para preparar o novo redesign antes de gerar.'})
  const overlay = mode === 'redesign' ? decodePagePng(body.overlay) : undefined
  const guide = mode === 'redesign' ? decodePagePng(body.guide) : undefined
  const [meta,mm]=await Promise.all([original,mask].map(b=>sharp(b,{limitInputPixels:16_000_000}).metadata())).catch(()=>{throw createError({statusCode:400,statusMessage:'Não foi possível ler o PNG da página.'})})
  if(!meta||!mm||!meta.width||!meta.height||meta.width>4096||meta.height>4096||meta.width!==mm.width||meta.height!==mm.height)throw createError({statusCode:400,statusMessage:'Dimensões de página ou proteção inválidas.'})
  const redesignArea: RedesignArea | undefined = mode === 'redesign' ? body.redesignArea : undefined
  if (mode === 'redesign' && (!redesignArea || ![redesignArea.left,redesignArea.top,redesignArea.width,redesignArea.height].every(Number.isInteger)
    || redesignArea.left < 0 || redesignArea.top < 0 || redesignArea.width < 1 || redesignArea.height < 1
    || redesignArea.left + redesignArea.width > meta.width || redesignArea.top + redesignArea.height > meta.height))
    throw createError({statusCode:400,statusMessage:'Área de redesign inválida.'})
  if (guide) {
    const guideMeta = await sharp(guide, {limitInputPixels:16_000_000}).metadata()
    if (guideMeta.width !== meta.width || guideMeta.height !== meta.height) throw createError({statusCode:400,statusMessage:'Guia de layout incompatível com a página.'})
  }
  if (overlay) {
    const overlayMeta = await sharp(overlay, {limitInputPixels:16_000_000}).metadata()
    if (overlayMeta.width !== meta.width || overlayMeta.height !== meta.height || !overlayMeta.hasAlpha) throw createError({statusCode:400,statusMessage:'Camada comercial incompatível com a página.'})
    const alpha = await sharp(overlay).extractChannel('alpha').raw().toBuffer()
  if (!alpha.some(v => v > 0) || !alpha.some(v => v < 255)) throw createError({statusCode:422,statusMessage:'Não foi possível separar o conteúdo e o design desta página. Revise a arte e tente novamente.'})
  }
  // Só o acabamento leve usa a máscara para limitar os pixels editáveis.
  // No redesign, a imagem gerada é usada por inteiro; a máscara participa
  // apenas da identidade do pedido e pode cobrir quase toda a página.
  if (mode === 'finish') {
    const pixels=await sharp(mask).removeAlpha().greyscale().raw().toBuffer();const coverage=pixels.reduce((n,v)=>n+(v>=128?1:0),0)/pixels.length
    if(coverage<=0||coverage>=0.995)throw createError({statusCode:422,statusMessage:'Não há áreas decorativas suficientes para melhorar esta página. Revise a arte e tente novamente.'})
  }
  const id=createHash('sha256').update(mode === 'redesign' ? REDESIGN_VERSION : 'v2').update(guide || '').update(mode).update(overlay || '').update(JSON.stringify(redesignArea || '')).update(projectId).update(pageId).update(model).update(quality).update(original).update(mask).digest('hex').slice(0,32)
  let created=false
  const receipt=await pgTx(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${userId}:enhancement`])
    const existing=await readEnhancement(userId,projectId,id);if(existing && !(body.retryFailed === true && existing.status === 'failed' && existing.costUsd === 0))return existing
    // Limite compartilhado entre instâncias, protegido pelo advisory lock do usuário.
    const ledgerKey=`projects/${userId}/enhancement-ledger.json`
    let ledger: {day:string; attempts:Array<{projectId:string;id:string}>}={day:new Date().toISOString().slice(0,10),attempts:[]}
    try {const saved=await getS3Client().send(new GetObjectCommand({Bucket:bucket(),Key:ledgerKey}));const parsed=JSON.parse(await saved.Body!.transformToString());if(parsed.day===ledger.day)ledger=parsed} catch(e:any){if(e?.$metadata?.httpStatusCode!==404&&e?.name!=='NoSuchKey')throw e}
    if(ledger.attempts.length>=20)throw createError({statusCode:429,statusMessage:'Limite de 20 páginas por dia atingido para esta conta.'})
    for(const previous of ledger.attempts.slice(-2)){const prior=await readEnhancement(userId,previous.projectId,previous.id);if(prior?.status==='processing'&&Date.now()-Date.parse(prior.updatedAt)<7*60_000)throw createError({statusCode:409,statusMessage:'Aguarde a página em processamento antes de iniciar outra.'})}
    const root=`${prefix(userId,projectId)}${id}`;const now=new Date().toISOString()
    const r:EnhancementReceipt={id,mode,pipelineVersion:mode === 'redesign' ? REDESIGN_VERSION : undefined,redesignArea,sourceHash:createHash('sha256').update(original).digest('hex'),projectId,pageId,model,quality,width:meta.width!,height:meta.height!,status:'processing',costUsd:null,createdAt:now,updatedAt:now,originalKey:root+'/original.png'}
    await put(r.originalKey,original,'image/png');await put(root+'/mask.png',mask,'image/png');if(overlay)await put(root+'/overlay.png',overlay,'image/png');if(guide)await put(root+'/guide.png',guide,'image/png');await writeReceipt(userId,r);ledger.attempts.push({projectId,id});await put(ledgerKey,JSON.stringify(ledger),'application/json');created=true;return r
  })
  return {receipt,run:created?()=>runEnhancement(userId,receipt,original,mask,overlay,guide):null}
}
const runEnhancement = async (userId: string, receipt: EnhancementReceipt, original: Buffer, mask: Buffer, overlay?: Buffer, guide?: Buffer) => {
  try {
    const references = receipt.mode === 'redesign' ? [original] : [original, mask]
    const response=await fetch('https://openrouter.ai/api/v1/images',{method:'POST',headers:{Authorization:`Bearer ${enhancementApiKey()}`,'Content-Type':'application/json','X-Title':'JobVarejo'},body:JSON.stringify({model:receipt.model,prompt:receipt.mode === 'redesign' ? REDESIGN_PROMPT : ENHANCEMENT_PROMPT,quality:receipt.quality,n:1,output_format:'png',aspect_ratio:enhancementAspectRatio(receipt.width,receipt.height),input_references:references.map(b=>({type:'image_url',image_url:{url:'data:image/png;base64,'+b.toString('base64')}}))}),signal:AbortSignal.timeout(300_000)})
    if(!response.ok){receipt.status=[400,401,402,403,404,422,429].includes(response.status)?'failed':'uncertain';receipt.costUsd=receipt.status==='failed'?0:null;receipt.error=receipt.status==='failed'?'Não foi possível concluir esta melhoria.':'A geração não foi confirmada. Consulte o histórico antes de tentar novamente.';await writeReceipt(userId,receipt);return}
    const data=await response.json() as any
    receipt.costUsd=typeof data.usage?.cost==='number'&&Number.isFinite(data.usage.cost)?data.usage.cost:null
    receipt.usage={promptTokens:data.usage?.prompt_tokens,completionTokens:data.usage?.completion_tokens,totalTokens:data.usage?.total_tokens}
    // Guarda o recibo de cobrança antes da composição ou persistência do resultado.
    await writeReceipt(userId,receipt)
    const encoded=data.data?.[0]?.b64_json
    if(typeof encoded!=='string'||encoded.length>64_000_000)throw new Error('invalid_provider_image')
    const generated=Buffer.from(encoded,'base64')
    await put(`${prefix(userId,receipt.projectId)}${receipt.id}/generated.png`,generated,'image/png')
    // No redesign, a edição completa do modelo já contém a montagem. Aplicar
    // novamente títulos/preços/fotos da camada local duplica textos e cria
    // molduras sobrepostas quando o modelo ajusta levemente seus contornos.
    const result = await finalizeEnhancementImage(receipt.mode || 'finish',original,generated,mask,receipt.width,receipt.height)
    receipt.resultKey=`${prefix(userId,receipt.projectId)}${receipt.id}/result.png`
    await put(receipt.resultKey,result,'image/png');receipt.status='completed';await writeReceipt(userId,receipt)
  } catch {
    receipt.status='uncertain';receipt.error='A geração não foi confirmada. Consulte o histórico antes de tentar novamente.'
    try {await writeReceipt(userId,receipt)}catch{console.error('[page-enhancement] Falha ao salvar recibo',receipt.id)}
  }
}
