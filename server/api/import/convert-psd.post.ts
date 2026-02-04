import { unlinkSync, mkdirSync, rmdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getS3Client } from '~/server/utils/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
// @ts-ignore - pngjs não tem tipos TypeScript oficiais
import { PNG } from 'pngjs'

// Lazy load ag-psd para reduzir bundle size
let agPsdModule: any = null
const getAgPsd = async () => {
  if (!agPsdModule) {
    agPsdModule = await import('ag-psd')
  }
  return agPsdModule
}

interface HTMLCanvasElement {
  width: number
  height: number
  getContext?: (context: string) => any
  toDataURL?: (format: string) => string
}

// Tipos locais para compatibilidade

// Type para HTMLCanvasElement no ambiente Node.js
interface HTMLCanvasElement {
  width: number
  height: number
  getContext?: (context: string) => any
  toDataURL?: (format: string) => string
}

// Tipos locais para ag-psd

/**
 * API Endpoint para conversão de arquivos PSD para canvas editável Fabric.js
 *
 * Fluxo:
 * 1. Recebe arquivo PSD via multipart form data
 * 2. Parse PSD com ag-psd
 * 3. Extrai camadas como imagens PNG, textos e formas vetoriais
 * 4. Upload assets para Contabo bucket (jobimport)
 * 5. Retorna JSON compatível com Fabric.js
 *
 * ag-psd suporta:
 * - Leitura de texto com estilos completos
 * - Formas vetoriais (path, rect, ellipse)
 * - Imagens rasterizadas
 */

// Função auxiliar para converter RGB para Hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Função auxiliar para deletar diretório recursivamente
function deleteFolderRecursive(dirPath: string) {
  if (existsSync(dirPath)) {
    const files = readdirSync(dirPath)
    files.forEach((file) => {
      const filePath = join(dirPath, file)
      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        deleteFolderRecursive(filePath)
      } else {
        unlinkSync(filePath)
      }
    })
    rmdirSync(dirPath)
  }
}

// Converter Uint8ClampedArray (RGBA) para PNG Buffer
function rgbaToPngBuffer(rgba: Uint8ClampedArray, width: number, height: number): Buffer {
  const png = new PNG({ width, height })

  // Copiar cada pixel manualmente para garantir ordem correta RGBA
  // Uint8ClampedArray tem valores [r, g, b, a, r, g, b, a, ...]
  const expectedLength = width * height * 4
  const actualLength = Math.min(rgba.length, expectedLength, png.data.length)

  let hasVisiblePixels = false

  for (let i = 0; i < actualLength; i += 4) {
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    let a = rgba[i + 3]

    // Se alpha for muito baixo, aumentar para garantir visibilidade
    if (a < 50) {
      a = 255 // Totalmente opaco
    }

    // Verificar se há pixels visíveis (não totalmente transparentes)
    if (a > 0) {
      hasVisiblePixels = true
    }

    png.data[i] = r
    png.data[i + 1] = g
    png.data[i + 2] = b
    png.data[i + 3] = a
  }

  // Se não houver pixels visíveis, criar imagem com cor escura visível
  if (!hasVisiblePixels) {
    console.log(`   ⚠️ Nenhum pixel visível encontrado, criando placeholder`)
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 50     // R (cinza escuro)
      png.data[i + 1] = 50 // G
      png.data[i + 2] = 50 // B
      png.data[i + 3] = 255 // A (totalmente opaco)
    }
  }

  // Preencher pixels restantes se houver mismatch de tamanho
  for (let i = actualLength; i < png.data.length; i += 4) {
    png.data[i] = 50     // R
    png.data[i + 1] = 50 // G
    png.data[i + 2] = 50 // B
    png.data[i + 3] = 255 // A
  }

  return PNG.sync.write(png)
}

// Tipos para ag-psd
interface AgPsdText {
  text: string
  transform?: number[]
  style?: {
    fontFamily?: string
    fontSize?: number
    fillColor?: number[]
    fontColor?: number[]
    fontWeight?: string
  }
  styleRuns?: Array<{
    from: number
    to: number
    styles: {
      fontFamily?: string
      fontSize?: number
      fillColor?: number[]
      fontColor?: number[]
    }
  }>
  paragraphStyle?: {
    justification?: 'left' | 'right' | 'center'
    leading?: number
  }
}

interface AgPsdLayer {
  name?: string
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
  opacity: number
  hidden: boolean
  blendMode: string
  visible: boolean
  text?: AgPsdText
  children?: AgPsdLayer[]
  image?: HTMLCanvasElement | ImageData
  canvas?: HTMLCanvasElement
  clippingMask?: boolean
  // Propriedades para formas vetoriais
  hasMask?: boolean
  vectorMask?: any
  pathData?: any
  // Propriedades para retângulos arredondados
  roundedCorners?: boolean
  radius?: number
}

interface AgPsdText {
  text: string
  transform?: number[] // matriz de transformação
  style?: {
    fontFamily?: string
    fontSize?: number
    fillColor?: number[]
    fontColor?: number[]
    fontWeight?: string
  }
  styleRuns?: Array<{
    from: number
    to: number
    styles: {
      fontFamily?: string
      fontSize?: number
      fillColor?: number[]
      fontColor?: number[]
    }
  }>
  paragraphStyle?: {
    justification?: 'left' | 'right' | 'center'
    leading?: number
  }
}

/**
 * Detecta se uma camada é uma forma vetorial (rect, ellipse, path)
 * ag-psd pode ter informações sobre formas vetoriais que podemos converter
 * Também detecta retângulos arredondados
 */
function detectVectorShape(layer: AgPsdLayer): { type: string; data: any; radius?: number } | null {
  // Verificar se há dados de caminho vetorial
  if (layer.vectorMask || layer.pathData) {
    // Tem dados vetoriais - converter para path do Fabric.js
    return { type: 'path', data: layer.vectorMask || layer.pathData }
  }

  // Verificar por nome indicativo de forma
  const name = (layer.name || '').toLowerCase()

  // Detectar retângulo arredondado pelo nome
  const isRounded = name.includes('rounded') || name.includes('arredondado') || name.includes('radius') || name.includes('round')

  if (name.includes('rect') || name.includes('square') || name.includes('retangle')) {
    // Extrair raio do nome se disponível (ex: "rect_20" ou "rounded_rect_30")
    let radius = 0
    if (isRounded) {
      // Tentar extrair número do nome
      const numberMatch = name.match(/(\d+)/)
      if (numberMatch) {
        radius = parseInt(numberMatch[1], 10)
      } else {
        // Se não houver número, usar um valor padrão baseado no tamanho
        radius = Math.min(layer.width, layer.height) * 0.1
      }
    }
    return { type: 'rect', data: null, radius }
  }
  if (name.includes('ellipse') || name.includes('circle') || name.includes('oval')) {
    return { type: 'ellipse', data: null }
  }
  if (name.includes('shape') || name.includes('forma')) {
    return { type: 'shape', data: null }
  }

  // Verificar se a camada tem apenas cor sólida (sem imagem)
  // Camadas de forma geralmente não têm 'image' ou 'canvas'
  if (!layer.image && !layer.canvas && !layer.text && !layer.children?.length) {
    // Pode ser uma forma vetorial ou camada de ajuste
    return { type: 'unknown', data: null }
  }

  return null
}

/**
 * Extrai cor de uma camada de forma vetorial
 * Analisa a imagem canvas para detectar a cor predominante
 */
function extractSolidColorFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext?.('2d')
  if (!ctx) return null

  const width = canvas.width
  const height = canvas.height
  if (width === 0 || height === 0) return null

  // Amostrar pixels para encontrar cor predominante
  const imageData = ctx.getImageData(0, 0, Math.min(width, 10), Math.min(height, 10))
  const data = imageData.data

  let r = 0, g = 0, b = 0, a = 0
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 100) { // Apenas pixels não transparentes
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      a += data[i + 3]
      count++
    }
  }

  if (count === 0) return null

  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)

  // Se for uma cor sólida (baixa variação), retornar hex
  return rgbToHex(r, g, b)
}

/**
 * Processa uma forma vetorial detectada, criando objeto Fabric.js editável
 */
function createVectorShapeObject(
  layer: any,
  shapeType: string,
  opacity: number,
  isVisible: boolean,
  customId: string,
  radius?: number
): any {
  const left = layer.left ?? 0
  const top = layer.top ?? 0
  const width = layer.width || 100
  const height = layer.height || 100

  // Tentar extrair cor do canvas se disponível
  let fill = '#cccccc' // Cor padrão cinza
  if (layer.canvas) {
    const extractedColor = extractSolidColorFromCanvas(layer.canvas)
    if (extractedColor) {
      fill = extractedColor
    }
  }

  // Base object template
  const baseObj = {
    version: '7.1.0',
    originX: 'left' as const,
    originY: 'top' as const,
    left,
    top,
    width,
    height,
    fill,
    stroke: null,
    strokeWidth: 0,
    opacity,
    visible: isVisible,
    name: layer.name || `Shape`,
    _customId: customId,
    _isVector: true // Marcador para identificar formas vetoriais
  }

  // Criar tipo específico de forma
  switch (shapeType) {
    case 'rect':
    case 'square':
      // Aplicar raio arredondado se detectado
      const cornerRadius = radius || layer.radius || 0
      return {
        type: 'rect',
        rx: cornerRadius,
        ry: cornerRadius,
        ...baseObj
      }

    case 'ellipse':
    case 'circle':
      return {
        type: 'circle',
        radius: Math.min(width, height) / 2,
        originX: 'left',
        originY: 'top',
        left: left + width / 2,
        top: top + height / 2,
        fill,
        opacity,
        visible: isVisible,
        name: layer.name || 'Circle',
        _customId: customId,
        _isVector: true
      }

    case 'path':
      // Para paths complexos, precisaríamos converter os dados do path
      // Por ora, criar um rect como placeholder
      return {
        type: 'rect',
        ...baseObj,
        name: (layer.name || 'Path') + ' (vector)',
        _pathData: layer.vectorMask || layer.pathData // Guardar para uso futuro
      }

    default:
      // Fallback para rect
      return {
        type: 'rect',
        ...baseObj
      }
  }
}

/**
 * Processa camada de texto do ag-psd
 */
function processTextLayer(
  layer: any,
  opacity: number,
  isVisible: boolean,
  customId: string
): any | null {
  try {
    const textData = layer.text
    if (!textData || !textData.text) {
      return null
    }

    const textValue = textData.text

    // Extrair propriedades de texto do ag-psd
    let fontSize = 16
    let fontFamily = 'Arial'
    let fontWeight: 'normal' | 'bold' = 'normal'
    let fontStyle = ''
    let fill = '#000000'
    let textAlign: 'left' | 'right' | 'center' = 'left'
    let charSpacing = 0
    let lineHeight = 1.16
    let underline = false

    // Extrair do style principal
    if (textData.style) {
      fontSize = textData.style.fontSize || fontSize
      fontFamily = textData.style.fontFamily || fontFamily

      // Cor do texto (ag-psd usa RGB 0-255 ou 0-1)
      if (textData.style.fillColor) {
        const color = textData.style.fillColor
        if (color.length >= 3) {
          // Verificar se está em 0-1 ou 0-255
          const r = color[0] > 1 ? color[0] : color[0] * 255
          const g = color[1] > 1 ? color[1] : color[1] * 255
          const b = color[2] > 1 ? color[2] : color[2] * 255
          fill = rgbToHex(r, g, b)
        }
      } else if (textData.style.fontColor) {
        const color = textData.style.fontColor
        if (color.length >= 3) {
          const r = color[0] > 1 ? color[0] : color[0] * 255
          const g = color[1] > 1 ? color[1] : color[1] * 255
          const b = color[2] > 1 ? color[2] : color[2] * 255
          fill = rgbToHex(r, g, b)
        }
      }

      if (textData.style.fontWeight) {
        fontWeight = textData.style.fontWeight === 'bold' ? 'bold' : 'normal'
      }
    }

    // Extrair do primeiro styleRun se disponível (mais preciso)
    if (textData.styleRuns && textData.styleRuns.length > 0) {
      const firstStyle = textData.styleRuns[0].styles
      if (firstStyle) {
        fontSize = firstStyle.fontSize || fontSize
        fontFamily = firstStyle.fontFamily || fontFamily
        if (firstStyle.fillColor && firstStyle.fillColor.length >= 3) {
          const r = firstStyle.fillColor[0] > 1 ? firstStyle.fillColor[0] : firstStyle.fillColor[0] * 255
          const g = firstStyle.fillColor[1] > 1 ? firstStyle.fillColor[1] : firstStyle.fillColor[1] * 255
          const b = firstStyle.fillColor[2] > 1 ? firstStyle.fillColor[2] : firstStyle.fillColor[2] * 255
          fill = rgbToHex(r, g, b)
        }
      }
    }

    // Alinhamento de parágrafo
    if (textData.paragraphStyle?.justification) {
      textAlign = textData.paragraphStyle.justification
    }

    // Line height
    if (textData.paragraphStyle?.leading) {
      lineHeight = textData.paragraphStyle.leading / fontSize
    }

    // Ajuste de cor para visibilidade
    if (fill === '#000000') {
      fill = '#FFFFFF'
    } else if (fill === '#FFFFFF') {
      fill = '#000000'
    }

    const left = layer.left ?? 0
    const top = layer.top ?? 0
    const textWidth = layer.width || 100
    const textHeight = layer.height || fontSize * lineHeight

    console.log(`📝 Texto: "${textValue}" fontSize=${fontSize} fill=${fill} opacity=${opacity}`)

    return {
      type: 'i-text',
      version: '7.1.0',
      originX: 'left',
      originY: 'top',
      left,
      top,
      width: Math.max(textWidth, 50),
      height: Math.max(textHeight, fontSize * lineHeight),
      fill,
      stroke: null,
      strokeWidth: 0,
      opacity,
      visible: isVisible,
      fontFamily,
      fontWeight,
      fontSize: Math.max(fontSize, 8),
      lineHeight,
      textAlign,
      fontStyle,
      charSpacing,
      underline,
      overline: false,
      linethrough: false,
      textBackgroundColor: '',
      splitByGrapheme: false,
      name: layer.name || 'Text',
      text: textValue,
      _customId: customId
    }
  } catch (err) {
    console.warn(`Failed to process text layer ${layer.name}:`, err)
    return null
  }
}

// Função para processar camada recursivamente e extrair objetos
async function processLayer(
  layer: any,
  canvasObjects: any[],
  s3Client: ReturnType<typeof getS3Client>,
  importBucket: string,
  userId: string,
  fileId: string,
  tempDir: string,
  depth = 0,
  layerIndex = depth,
  layerCounter = { value: depth },
  processedIds = new Set<string>(),
  flattenGroups = false // Nova opção: desagrupar elementos
): Promise<void> {
  // Gerar ID único para o objeto
  const customId = `${fileId}_layer_${layerIndex}`

  // Skip if already processed
  if (processedIds.has(customId)) {
    return
  }
  processedIds.add(customId)

  // ag-psd usa opacity (0-255) e hidden (boolean)
  // Converter opacity para 0-1 para Fabric.js
  const opacity = (layer.opacity ?? 255) / 255
  const isVisible = !layer.hidden && opacity > 0

  console.log(`🔍 [${depth}] ${layer.name || 'unnamed'} (${layer.width}x${layer.height}) opacity=${opacity.toFixed(2)} hidden=${layer.hidden}`)

  // Se for grupo, processar filhos recursivamente
  if (layer.children && layer.children.length > 0) {
    console.log(`📁 Grupo: ${layer.name || 'unnamed'} (${layer.children.length} filhos) ${flattenGroups ? '→ DESAGRUPANDO' : '→ MANTER GRUPO'}`)

    const groupObjects: any[] = []

    for (const child of layer.children) {
      const childIndex = ++layerCounter.value
      await processLayer(
        child,
        flattenGroups ? canvasObjects : groupObjects, // Se flatten, adicionar direto ao canvas
        s3Client,
        importBucket,
        userId,
        fileId,
        tempDir,
        depth + 1,
        childIndex,
        layerCounter,
        processedIds,
        flattenGroups
      )
    }

    // Se não estiver desagrupando, criar o grupo
    if (!flattenGroups && groupObjects.length > 0) {
      canvasObjects.push({
        type: 'group',
        version: '7.1.0',
        originX: 'left',
        originY: 'top',
        left: layer.left ?? 0,
        top: layer.top ?? 0,
        width: layer.width || 100,
        height: layer.height || 100,
        opacity,
        visible: isVisible,
        objects: groupObjects,
        name: layer.name || `Group ${depth}`,
        _customId: customId
      })
    }

    return
  }

  // 1. Prioridade: Texto
  if (layer.text) {
    const textObj = processTextLayer(layer, opacity, isVisible, customId)
    if (textObj) {
      canvasObjects.push(textObj)
      console.log(`✅ Texto processado: ${layer.text?.text?.substring(0, 30)}...`)
    }
    return
  }

  // 2. Detectar formas vetoriais
  const vectorShape = detectVectorShape(layer)
  if (vectorShape) {
    // Verificar se tem canvas/image para extrair a cor
    const hasImage = layer.canvas || layer.image
    if (hasImage || vectorShape.type !== 'unknown') {
      const shapeObj = createVectorShapeObject(layer, vectorShape.type, opacity, isVisible, customId, vectorShape.radius)
      canvasObjects.push(shapeObj)
      console.log(`🔷 Forma vetorial: ${vectorShape.type} - ${layer.name}${vectorShape.radius ? ` (radius: ${vectorShape.radius})` : ''}`)
      return
    }
  }

  // 3. Camada de imagem raster
  if (layer.canvas || layer.image) {
    try {
      const canvas = layer.canvas || layer.image as HTMLCanvasElement
      const imgWidth = canvas.width
      const imgHeight = canvas.height

      console.log(`🖼️ Imagem: ${layer.name} ${imgWidth}x${imgHeight}`)

      // Detectar se a imagem deve ter cantos arredondados
      // Verificar nome da camada e propriedades
      const name = (layer.name || '').toLowerCase()
      let cornerRadius = 0

      if (name.includes('rounded') || name.includes('arredondado') || name.includes('radius') || name.includes('round')) {
        // Tentar extrair número do nome
        const numberMatch = name.match(/(\d+)/)
        if (numberMatch) {
          cornerRadius = parseInt(numberMatch[1], 10)
        } else {
          // Se não houver número, usar um valor padrão baseado no tamanho
          cornerRadius = Math.min(imgWidth, imgHeight) * 0.1
        }
      }

      // Converter canvas para PNG Buffer
      const dataUrl = (canvas as HTMLCanvasElement).toDataURL?.('image/png')
      if (!dataUrl) {
        console.warn(`Failed to convert canvas to data URL`)
        return
      }
      const pngBuffer = Buffer.from(dataUrl.split(',')[1], 'base64')

      // Upload para Contabo
      const layerFilename = `layer_${layerCounter.value}_${depth}.png`
      const assetKey = `import-files/${userId}/${fileId}/${layerFilename}`
      await s3Client.send(new PutObjectCommand({
        Bucket: importBucket,
        Key: assetKey,
        Body: pngBuffer,
        ContentType: 'image/png'
      }))

      const config = useRuntimeConfig()
      const assetUrl = `https://${config.contaboEndpoint}/${importBucket}/${assetKey}`

      const imageObj: any = {
        type: 'image',
        version: '7.1.0',
        originX: 'left',
        originY: 'top',
        left: layer.left ?? 0,
        top: layer.top ?? 0,
        width: imgWidth,
        height: imgHeight,
        src: assetUrl,
        crossOrigin: 'anonymous',
        opacity,
        visible: isVisible,
        name: layer.name || `Layer ${depth}`,
        _customId: customId
      }

      // Aplicar cantos arredondados se detectados
      if (cornerRadius > 0) {
        imageObj.rx = cornerRadius
        imageObj.ry = cornerRadius
        imageObj.clipPath = {
          type: 'rect',
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          width: imgWidth,
          height: imgHeight,
          rx: cornerRadius,
          ry: cornerRadius
        }
        console.log(`🔲 Imagem com cantos arredondados: radius=${cornerRadius}`)
      }

      canvasObjects.push(imageObj)

      console.log(`✅ Imagem processada: ${layer.name}`)
    } catch (err) {
      console.warn(`Failed to process image layer ${layer.name}:`, err)
    }
    return
  }

  // 4. Placeholder para camadas não processadas
  console.log(`⚠️ Camada não processada: ${layer.name} - criando placeholder`)
  canvasObjects.push({
    type: 'rect',
    version: '7.1.0',
    originX: 'left',
    originY: 'top',
    left: layer.left ?? 0,
    top: layer.top ?? 0,
    width: layer.width || 100,
    height: layer.height || 100,
    fill: 'rgba(128,128,128,0.3)',
    stroke: '#666',
    strokeWidth: 1,
    strokeDashArray: [5, 5],
    opacity,
    visible: isVisible,
    name: layer.name || `Layer ${depth} (placeholder)`,
    _customId: customId,
    _isPlaceholder: true
  })
}

export default defineEventHandler(async (event) => {
  console.log('=== PSD Import API Called (ag-psd) ===')

  // Ler multipart form data
  const formData = await readMultipartFormData(event)
  console.log('FormData fields:', formData?.map(f => f.name))

  const fileField = formData?.find(f => f.name === 'file')

  // Verificar se há parâmetro para desabilitar auto-center
  const autoCenterField = formData?.find(f => f.name === 'autoCenter')
  const autoCenter = autoCenterField?.data ? autoCenterField.data.toString() !== 'false' : false

  // Nova opção: desagrupar elementos (flatten)
  const flattenField = formData?.find(f => f.name === 'flatten')
  const flattenGroups = flattenField?.data ? flattenField.data.toString() === 'true' : true

  if (!fileField || !fileField.filename) {
    throw createError({
      statusCode: 400,
      message: 'Nenhum arquivo enviado. Use campo "file" no multipart form data.'
    })
  }

  const filename = fileField.filename
  if (!filename.toLowerCase().endsWith('.psd')) {
    throw createError({
      statusCode: 400,
      message: 'Apenas arquivos .psd são suportados.'
    })
  }

  // Obter userId do FormData
  const userIdField = formData?.find(f => f.name === 'userId')
  const userId = userIdField?.data ? userIdField.data.toString() : null

  if (!userId) {
    throw createError({
      statusCode: 401,
      message: 'userId não fornecido.'
    })
  }

  // Gerar ID único para esta importação
  const fileId = crypto.randomUUID()

  // Criar diretório temporário
  const tempDir = `/tmp/psd-${fileId}`
  mkdirSync(tempDir, { recursive: true })

  try {
    console.log(`Processing PSD: ${filename} (${fileField.data.length} bytes)`)
    console.log(`Auto-center: ${autoCenter}, Flatten groups: ${flattenGroups}`)

    // Converter Buffer para Uint8Array para ag-psd
    const uint8Array = new Uint8Array(fileField.data)

    // Parsear PSD com ag-psd (importação dinâmica)
    const { readPsd } = await getAgPsd()
    let psd: any
    try {
      psd = readPsd(uint8Array, {
        useImageData: true // Usa ImageData ao invés de Canvas para evitar premultiplicação
      })
      console.log(`✅ PSD parsed: ${psd.width}x${psd.height}, children: ${psd.children?.length || 0}`)
    } catch (parseError: any) {
      console.error('Failed to parse PSD:', parseError)
      throw new Error(`Failed to parse PSD file: ${parseError.message}`)
    }

    // Configurar cliente S3 para Contabo
    const s3Client = getS3Client()
    const config = useRuntimeConfig()
    let importBucket = config.contaboImportBucket || config.contaboBucket || 'jobupload'

    console.log(`Import bucket: ${importBucket}, endpoint: ${config.contaboEndpoint}`)

    // Upload do arquivo PSD original
    const originalKey = `import-files/${userId}/${fileId}.psd`

    // Tentar upload com retry usando bucket principal se falhar
    let uploadSuccess = false
    let s3Result: any = null

    for (const bucketToTry of [importBucket, config.contaboBucket || 'jobupload']) {
      if (uploadSuccess) break

      try {
        s3Result = await s3Client.send(new PutObjectCommand({
          Bucket: bucketToTry,
          Key: originalKey,
          Body: fileField.data,
          ContentType: 'image/vnd.adobe.photoshop'
        }))
        console.log(`✅ Original PSD uploaded to ${bucketToTry}:`, {
          $metadata: s3Result?.$metadata
        })
        // Atualizar importBucket para o bucket que funcionou
        importBucket = bucketToTry
        uploadSuccess = true
      } catch (s3Error: any) {
        console.warn(`❌ Failed to upload to ${bucketToTry}:`, s3Error.name)
        if (bucketToTry === (config.contaboBucket || 'jobupload')) {
          // Última tentativa falhou
          console.error('=== S3 UPLOAD ERROR - ALL BUCKETS FAILED ===')
          console.error('Error name:', s3Error.name)
          console.error('Error code:', s3Error.$metadata?.httpStatusCode)
          console.error('Error message:', s3Error.message)
          throw new Error(`Failed to upload to storage: ${s3Error.message} (code: ${s3Error.name})`)
        }
      }
    }

    // Array para armazenar objetos convertidos
    const canvasObjects: any[] = []

    // Contador global para nomes únicos de camadas
    const layerCounter = { value: 0 }

    // Set para rastrear IDs processados e evitar duplicatas
    const processedIds = new Set<string>()

    // ag-psd usa apenas `children` para as camadas
    const layersToProcess = psd.children || []

    console.log(`Processing ${layersToProcess.length} top layers...`)
    console.log(`PSD width: ${psd.width}, height: ${psd.height}`)

    // Função wrapper para passar o contador global
    async function processLayerWithCounter(layer: AgPsdLayer, depth: number) {
      const currentIndex = ++layerCounter.value
      await processLayer(
        layer,
        canvasObjects,
        s3Client,
        importBucket,
        userId!,
        fileId,
        tempDir,
        depth,
        currentIndex,
        layerCounter,
        processedIds,
        flattenGroups
      )
    }

    for (let i = 0; i < layersToProcess.length; i++) {
      const child = layersToProcess[i]
      console.log(`\n========== Processing top layer ${i + 1}/${layersToProcess.length}: ${child.name || 'unnamed'} ==========`)
      try {
        await processLayerWithCounter(child, 0)
      } catch (layerError: any) {
        console.error(`Failed to process layer ${child.name}:`, layerError)
        // Continua com outras camadas mesmo se uma falhar
      }
    }

    console.log(`\n========== SUMMARY ==========`)
    console.log(`Total objects extracted: ${canvasObjects.length}`)
    console.log(`Total layers processed: ${layerCounter.value}`)

    // Contar tipos de objetos
    const typeCounts: Record<string, number> = {}
    canvasObjects.forEach(obj => {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1
    })
    console.log(`Object types:`, typeCounts)

    // ===== AUTO-CENTER (OPCIONAL) =====
    let boundingBox = null

    if (autoCenter) {
      // Calcular o bounding box de todos os objetos
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      canvasObjects.forEach(obj => {
        const x = obj.left || 0
        const y = obj.top || 0
        const w = obj.width || 0
        const h = obj.height || 0
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x + w)
        maxY = Math.max(maxY, y + h)
      })

      if (minX !== Infinity) {
        console.log(`=== BOUNDING BOX DOS OBJETOS ===`)
        console.log(`Min: (${minX}, ${minY}), Max: (${maxX}, ${maxY})`)
        console.log(`Width: ${maxX - minX}, Height: ${maxY - minY}`)

        // Calcular offset para centralizar no canvas
        const contentWidth = maxX - minX
        const contentHeight = maxY - minY
        const canvasCenterX = 1080 / 2
        const canvasCenterY = 1080 / 2
        const contentCenterX = minX + contentWidth / 2
        const contentCenterY = minY + contentHeight / 2

        const offsetX = canvasCenterX - contentCenterX
        const offsetY = canvasCenterY - contentCenterY

        // Aplicar offset a todos os objetos
        canvasObjects.forEach(obj => {
          obj.left = (obj.left || 0) + offsetX
          obj.top = (obj.top || 0) + offsetY
        })

        console.log(`✅ Auto-center aplicado: offset=${offsetX.toFixed(0)},${offsetY.toFixed(0)}`)

        boundingBox = { minX, minY, maxX, maxY }
      }
    } else {
      console.log('ℹ️ Auto-center desabilitado - mantendo posições originais do PSD')
    }

    // Criar estrutura JSON do Fabric.js
    const canvasJson = {
      version: '7.1.0',
      objects: canvasObjects,
      // Metadata para viewport e informações de importação
      _psdImport: {
        canvasWidth: psd.width,
        canvasHeight: psd.height,
        boundingBox: boundingBox,
        autoCenter: autoCenter,
        flattenGroups: flattenGroups,
        originalDimensions: {
          width: psd.width,
          height: psd.height
        },
        library: 'ag-psd'
      }
    }

    // Salvar JSON convertido
    const jsonKey = `import-files/${userId}/${fileId}.json`
    await s3Client.send(new PutObjectCommand({
      Bucket: importBucket,
      Key: jsonKey,
      Body: JSON.stringify(canvasJson),
      ContentType: 'application/json'
    }))

    // URL pública do JSON
    const jsonUrl = `https://${config.contaboEndpoint}/${importBucket}/${jsonKey}`

    console.log(`✅ PSD conversion complete: ${canvasObjects.length} objects extracted`)

    // Retornar dados da conversão
    return {
      success: true,
      fileId,
      importData: {
        canvasWidth: psd.width,
        canvasHeight: psd.height,
        objects: canvasObjects,
        metadata: {
          originalFilename: filename,
          originalFormat: 'psd',
          convertedAt: new Date().toISOString(),
          layerCount: canvasObjects.length,
          objectTypes: typeCounts,
          autoCenter: autoCenter,
          flattenGroups: flattenGroups
        }
      },
      canvasJson,
      urls: {
        original: `https://${config.contaboEndpoint}/${importBucket}/${originalKey}`,
        json: jsonUrl
      }
    }

  } catch (error: any) {
    console.error('=== ERRO AO PROCESSAR PSD ===')
    console.error('Erro:', error.message)
    console.error('Stack:', error.stack)
    console.error('Erro completo:', error)

    // Retornar erro mais detalhado
    const errorMessage = error?.message || 'Erro desconhecido'

    throw createError({
      statusCode: 500,
      message: `Erro ao processar PSD: ${errorMessage}`
    })
  } finally {
    // Cleanup: deletar diretório temporário
    try {
      deleteFolderRecursive(tempDir)
    } catch (err) {
      console.warn('Failed to cleanup temp dir:', err)
    }
  }
})
