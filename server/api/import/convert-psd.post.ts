import { writeFile, unlinkSync, mkdirSync, rmdirSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getS3Client } from '~/server/utils/s3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import Psd from '@webtoon/psd'
import { PNG } from 'pngjs'

/**
 * API Endpoint para conversão de arquivos PSD para canvas editável Fabric.js
 *
 * Fluxo:
 * 1. Recebe arquivo PSD via multipart form data
 * 2. Parse PSD com @webtoon/psd
 * 3. Extrai camadas como imagens PNG e textos
 * 4. Upload assets para Contabo bucket (jobimport)
 * 5. Retorna JSON compatível com Fabric.js
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
  layerCounter = { value: depth }
): Promise<void> {
  // Pular camadas ocultas - @webtoon/psd usa isHidden
  // MAS processar filhos mesmo se o pai estiver oculto (camadas podem estar visíveis dentro de grupo oculto)
  const isHidden = layer.isHidden || layer.composedOpacity === 0

  // Gerar ID único para o objeto usando layerIndex global
  const customId = `${fileId}_layer_${layerIndex}`

  // DEBUG: Log tipo da camada
  console.log(`🔍 Processando camada: ${layer.name || 'unnamed'} (depth: ${depth}, type: ${layer?.type})`)
  console.log(`   Tem texto? ${!!layer.text}, Tem filhos? ${!!layer.children?.length}`)
  console.log(`   Dimensões: ${layer.width}x${layer.height}, Posição: (${layer.left}, ${layer.top})`)
  console.log(`   isHidden: ${isHidden}, Opacidade: ${layer.opacity} (${layer.composedOpacity})`)

  // Se for um grupo, processar recursivamente e criar um fabric.Group
  if (layer.type === 'Group') {
    console.log(`📁 Processando GRUPO: ${layer.name || 'unnamed'} com ${layer.children?.length || 0} filhos`)
    
    const groupObjects: any[] = []
    
    // Processar todos os filhos do grupo
    if (layer.children && Array.isArray(layer.children)) {
      for (const child of layer.children) {
        const childIndex = ++layerCounter.value
        await processLayer(child, groupObjects, s3Client, importBucket, userId, fileId, tempDir, depth + 1, childIndex, layerCounter)
      }
    }
    
    // Só criar o grupo se tiver objetos filhos e não estiver oculto
    if (groupObjects.length > 0 && !isHidden) {
      // Usar opacidade real do grupo
      const opacity = Math.max(0, Math.min(1, layer.composedOpacity ?? layer.opacity ?? 1))
      
      // Criar objeto de grupo compatível com Fabric.js
      const groupObj = {
        type: 'group',
        version: '7.1.0',
        originX: 'left',
        originY: 'top',
        left: layer.left ?? 0,
        top: layer.top ?? 0,
        width: layer.width || 100,
        height: layer.height || 100,
        fill: 'rgb(0,0,0)',
        stroke: null,
        strokeWidth: 0,
        strokeDashArray: null,
        strokeLineCap: 'butt',
        strokeDashOffset: 0,
        strokeLineJoin: 'miter',
        strokeUniform: false,
        strokeMiterLimit: 4,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        flipX: false,
        flipY: false,
        opacity: opacity,
        shadow: null,
        visible: true,
        backgroundColor: '',
        fillRule: 'nonzero',
        paintFirst: 'fill',
        globalCompositeOperation: 'source-over',
        skewX: 0,
        skewY: 0,
        objects: groupObjects,
        name: layer.name || `Group ${depth}`,
        _customId: customId
      }
      
      canvasObjects.push(groupObj)
      console.log(`✅ Grupo criado: ${layer.name} com ${groupObjects.length} objetos, opacity=${opacity}`)
    } else if (groupObjects.length > 0) {
      // Se o grupo está oculto mas tem filhos, adicionar os filhos diretamente (flat)
      // para manter a visibilidade individual
      console.log(`⚠️ Grupo oculto, adicionando ${groupObjects.length} objetos individualmente`)
      canvasObjects.push(...groupObjects)
    }
    
    return // Grupo processado, não continuar
  }

  // Se não for um grupo e não estiver oculto, processar conteúdo (imagem ou texto)
  if (!isHidden) {
    // Processar camada que tem imagem (pixel data)
    // @webtoon/psd usa composite() para obter pixels RGBA
    if (layer.width > 0 && layer.height > 0) {
      try {
        // Extrair imagem da camada como RGBA (Uint8ClampedArray)
        const rgba = await layer.composite()
        const imgWidth = layer.width
        const imgHeight = layer.height

        console.log(`Layer ${layer.name}: ${imgWidth}x${imgHeight}, RGBA size: ${rgba.length} bytes`)

        // DEBUG: Analisar pixels para detectar problemas
        let totalR = 0, totalG = 0, totalB = 0, totalA = 0
        let transparentPixels = 0, whitePixels = 0

        for (let i = 0; i < Math.min(rgba.length, 1000); i += 4) {
          totalR += rgba[i]
          totalG += rgba[i + 1]
          totalB += rgba[i + 2]
          totalA += rgba[i + 3]

          if (rgba[i + 3] < 10) transparentPixels++
          if (rgba[i] > 240 && rgba[i + 1] > 240 && rgba[i + 2] > 240 && rgba[i + 3] > 200) whitePixels++
        }

        const pixelCount = Math.min(rgba.length, 1000) / 4
        console.log(`   Média RGB: (${Math.round(totalR/pixelCount)}, ${Math.round(totalG/pixelCount)}, ${Math.round(totalB/pixelCount)})`)
        console.log(`   Média Alpha: ${Math.round(totalA/pixelCount)}`)
        console.log(`   Pixels transparentes: ${transparentPixels}/${pixelCount}, Pixels brancos: ${whitePixels}/${pixelCount}`)

        // Converter RGBA para PNG usando pngjs
        const pngBuffer = rgbaToPngBuffer(rgba, imgWidth, imgHeight)

        // Salvar arquivo temporariamente
        const layerFilename = `layer_${depth}.png`
        const layerPath = join(tempDir, layerFilename)
        writeFile(layerPath, pngBuffer, () => {})

        // Upload para Contabo
        const assetKey = `import-files/${userId}/${fileId}/${layerFilename}`
        await s3Client.send(new PutObjectCommand({
          Bucket: importBucket,
          Key: assetKey,
          Body: pngBuffer,
          ContentType: 'image/png'
        }))

        // URL pública do asset
        const config = useRuntimeConfig()
        const assetUrl = `https://${config.contaboEndpoint}/${importBucket}/${assetKey}`

        // Usar opacidade real do PSD - @webtoon/psd retorna composedOpacity (0-1)
        const opacity = Math.max(0, Math.min(1, layer.composedOpacity ?? layer.opacity ?? 1))
        console.log(`   Opacidade: ${opacity}`)

        canvasObjects.push({
          type: 'image',
          version: '7.1.0',
          originX: 'left',
          originY: 'top',
          left: layer.left ?? 0,
          top: layer.top ?? 0,
          width: imgWidth,
          height: imgHeight,
          fill: 'rgb(0,0,0)',
          stroke: null,
          strokeWidth: 0,
          strokeDashArray: null,
          strokeLineCap: 'butt',
          strokeDashOffset: 0,
          strokeLineJoin: 'miter',
          strokeUniform: false,
          strokeMiterLimit: 4,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          flipX: false,
          flipY: false,
          opacity: opacity,
          shadow: null,
          visible: true,
          backgroundColor: '',
          fillRule: 'nonzero',
          paintFirst: 'fill',
          globalCompositeOperation: 'source-over',
          skewX: 0,
          skewY: 0,
          cropX: 0,
          cropY: 0,
          src: assetUrl,
          crossOrigin: 'anonymous',
          filters: [],
          name: layer.name || `Layer ${depth}`,
          _customId: customId
        })

        console.log(`✅ Imagem criada: ${layer.name} at (${layer.left ?? 0}, ${layer.top ?? 0}), ${imgWidth}x${imgHeight}, opacity=${opacity}`)
      } catch (err) {
        console.warn(`Failed to process layer image for ${layer.name}:`, err)
      }
    }

    // Processar camada de texto
    // @webtoon/psd usa propriedade `text` para conteúdo e `textProperties` para estilos
    if (layer.text) {
      try {
        const textValue = layer.text
        const textProps = layer.textProperties

        // Extrair informações de fonte das textProperties
        let fontSize = 16
        let fontFamily = 'Arial'
        let fontWeight = 'normal'
        let fontStyle = ''
        let fill = '#000000'
        let textAlign = 'left'
        let charSpacing = 0
        let underline = false
        let lineHeight = 1.16
        let textWidth = 100
        let textHeight = 20
        let baselineShift = 0

        if (textProps) {
          // @webtoon/psd textProperties estrutura
          if (textProps.documentData) {
            const docData = textProps.documentData
            fontSize = docData.fontSize || 16
            fontFamily = docData.fontFamily || 'Arial'

            // Cor do texto
            if (docData.textColor) {
              const color = docData.textColor
              if (color.r !== undefined) {
                fill = rgbToHex(color.r * 255, color.g * 255, color.b * 255)
              }
            }

            // Alinhamento de texto
            if (docData.justification) {
              const justifMap: Record<number, string> = {
                0: 'left',
                1: 'right', 
                2: 'center',
                3: 'justify'
              }
              textAlign = justifMap[docData.justification] || 'left'
            }

            // Peso da fonte (fauxBold)
            if (docData.fauxBold) {
              fontWeight = 'bold'
            }

            // Estilo itálico (fauxItalic)
            if (docData.fauxItalic) {
              fontStyle = 'italic'
            }

            // Espaçamento entre letras (tracking)
            // PSD tracking é em 1/1000 de em, converter para pixels
            if (docData.tracking !== undefined) {
              charSpacing = (docData.tracking / 1000) * fontSize
            }

            // Underline
            if (docData.underline) {
              underline = true
            }

            // Line height (leading)
            if (docData.leading !== undefined && docData.leading > 0) {
              lineHeight = docData.leading / fontSize
            }
          }

          // Extrair dimensões reais do texto do PSD
          if (textProps.boundingBox) {
            const bbox = textProps.boundingBox
            if (bbox.right !== undefined && bbox.left !== undefined) {
              textWidth = Math.abs(bbox.right - bbox.left)
            }
            if (bbox.bottom !== undefined && bbox.top !== undefined) {
              textHeight = Math.abs(bbox.bottom - bbox.top)
            }
          }

          // Baseline para ajuste de posição
          if (textProps.baselineShift !== undefined) {
            baselineShift = textProps.baselineShift
          }
        }

        // Cor padrão para texto escuro: usar branco se a cor for muito escura
        // para garantir visibilidade em fundo escuro
        if (fill === '#000000' || fill === '#000' || fill === 'black') {
          fill = '#FFFFFF'
        }
        // Se a cor for muito clara (quase branca), usar preto para contraste
        else if (fill === '#FFFFFF' || fill === '#FFF' || fill === 'white') {
          fill = '#000000'
        }

        // Posição PSD para Fabric.js
        const psdLeft = layer.left ?? 0
        const psdTop = layer.top ?? 0

        console.log(`Text layer: "${textValue}" at position (${psdLeft}, ${psdTop}), fontSize: ${fontSize}, fill: ${fill}`)

        // Usar opacidade real do PSD
        const opacity = Math.max(0, Math.min(1, layer.composedOpacity ?? layer.opacity ?? 1))
        console.log(`   Opacidade do texto: ${opacity}`)

        canvasObjects.push({
          type: 'i-text',
          version: '7.1.0',
          originX: 'left',
          originY: 'top',
          left: psdLeft,
          top: psdTop - baselineShift, // Ajustar por baseline shift
          width: Math.max(textWidth, 50),
          height: Math.max(textHeight, fontSize * lineHeight),
          fill: fill,
          stroke: null,
          strokeWidth: 0,
          strokeDashArray: null,
          strokeLineCap: 'butt',
          strokeDashOffset: 0,
          strokeLineJoin: 'miter',
          strokeUniform: false,
          strokeMiterLimit: 4,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          flipX: false,
          flipY: false,
          opacity: opacity,
          shadow: null,
          visible: true,
          backgroundColor: '',
          fillRule: 'nonzero',
          paintFirst: 'fill',
          globalCompositeOperation: 'source-over',
          skewX: 0,
          skewY: 0,
          fontFamily: fontFamily,
          fontWeight: fontWeight,
          fontSize: Math.max(fontSize, 8),
          lineHeight: lineHeight,
          underline: underline,
          overline: false,
          linethrough: false,
          textAlign: textAlign,
          fontStyle: fontStyle,
          textBackgroundColor: '',
          charSpacing: charSpacing,
          minWidth: 20,
          splitByGrapheme: false,
          name: layer.name || 'Text Layer',
          text: textValue,
          _customId: customId
        })

        console.log(`✅ Texto criado: "${textValue}" at (${psdLeft}, ${psdTop}), opacity=${opacity}, fill=${fill}`)
      } catch (err) {
        console.warn(`Failed to process text layer ${layer.name}:`, err)
      }
    }
  }

  // NOTA: Filhos de grupos são processados no bloco de tratamento de grupos acima
  // Camadas normais (não-grupos) não devem ter filhos no PSD
}

export default defineEventHandler(async (event) => {
  console.log('=== PSD Import API Called (@webtoon/psd) ===')

  // Ler multipart form data
  const formData = await readMultipartFormData(event)
  console.log('FormData fields:', formData?.map(f => f.name))

  const fileField = formData?.find(f => f.name === 'file')

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

    // Converter Buffer para ArrayBuffer para @webtoon/psd
    const arrayBuffer = fileField.data.buffer.slice(
      fileField.data.byteOffset,
      fileField.data.byteOffset + fileField.data.byteLength
    )

    // Parsear PSD com @webtoon/psd
    let psd: Psd
    try {
      psd = Psd.parse(arrayBuffer)
      console.log(`PSD parsed: ${psd.width}x${psd.height}, children: ${psd.children?.length || 0}`)
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

    // Contador global para nomes únicos de camadas (usado como objeto para referência)
    const layerCounter = { value: 0 }

    // Processar camadas - @webtoon/psd usa `children` e `layers`
    // Tenta ambas as propriedades para garantir que capturamos todas as camadas
    const layersToProcess = psd.children || psd.layers || []

    console.log(`Processing ${layersToProcess.length} top layers...`)
    console.log(`PSD width: ${psd.width}, height: ${psd.height}`)
    console.log(`PSD children: ${psd.children?.length || 0}, layers: ${psd.layers?.length || 0}`)

    // Função wrapper para passar o contador global
    async function processLayerWithCounter(layer: any, depth: number) {
      const currentIndex = ++layerCounter.value
      await processLayer(layer, canvasObjects, s3Client, importBucket, userId!, fileId, tempDir, depth, currentIndex, layerCounter)
    }

    for (let i = 0; i < layersToProcess.length; i++) {
      const child = layersToProcess[i]
      console.log(`\n========== Processing top layer ${i + 1}/${layersToProcess.length}: ${child.name || 'unnamed'} (type: ${child?.type}) ==========`)
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

    console.log(`Total objects extracted: ${canvasObjects.length}`)

    // Log detalhado dos objetos para debug
    console.log('=== OBJETOS EXTRAÍDOS DO PSD ===')
    canvasObjects.forEach((obj, i) => {
      console.log(`[${i}] ${obj.type} - ${obj.name || obj.text || 'unnamed'}`)
      console.log(`    Posição: left=${obj.left}, top=${obj.top}`)
      console.log(`    Dimensões: width=${obj.width}, height=${obj.height}`)
      console.log(`    Visível: ${obj.visible}, Opacidade: ${obj.opacity}`)
      if (obj.type === 'image') {
        console.log(`    Src: ${obj.src}`)
      } else if (obj.type === 'i-text') {
        console.log(`    Texto: "${obj.text}", fill: ${obj.fill}, fontSize: ${obj.fontSize}`)
      }
    })

    // ===== AUTO-CENTER =====
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

      // Calcular offset para centralizar no canvas (1080x1080)
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

      console.log(`✅ Auto-center: offset=${offsetX.toFixed(0)},${offsetY.toFixed(0)}, objects=${canvasObjects.length}`)
    }

    // Criar estrutura JSON do Fabric.js
    const canvasJson = {
      version: '7.1.0',
      objects: canvasObjects,
      // Adicionar metadata para ajudar no viewport
      _psdImport: {
        canvasWidth: psd.width,
        canvasHeight: psd.height,
        boundingBox: minX !== Infinity ? { minX, minY, maxX, maxY } : null,
        autoCenter: true
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

    console.log(`PSD conversion complete: ${canvasObjects.length} layers extracted`)

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
          layerCount: canvasObjects.length
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
