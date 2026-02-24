type CandidateImage = { url: string; title?: string; source?: string }
type ProductInfo = {
  name: string
  brand?: string
  flavor?: string
  weight?: string
  productCode?: string
  normalizedQuery?: string
}

let openaiInstance: any = null

const getOpenAI = async () => {
  if (!openaiInstance) {
    const { default: OpenAI } = await import('openai')
    const config = useRuntimeConfig()
    openaiInstance = new OpenAI({ apiKey: config.openaiApiKey || '' })
  }
  return openaiInstance
}

export async function validateProductImageCandidatesWithAI(
  candidates: CandidateImage[],
  productInfo: ProductInfo
): Promise<{ bestIndex: number; confidence: number; reason: string; isExactMatch: boolean; mismatchReasons: string[] }> {
  try {
    const openai = await getOpenAI()

    const desc = [productInfo.name]
    if (productInfo.brand) desc.push(`Marca: ${productInfo.brand}`)
    if (productInfo.flavor) desc.push(`Sabor/Variante: ${productInfo.flavor}`)
    if (productInfo.weight) desc.push(`Peso/Volume: ${productInfo.weight}`)
    if (productInfo.productCode) desc.push(`Codigo Produto/EAN: ${productInfo.productCode}`)
    if (productInfo.normalizedQuery) desc.push(`Consulta Normalizada: ${productInfo.normalizedQuery}`)
    const productDescription = desc.join(' | ')

    const imageContents = candidates
      .map((entry, i) => [
        {
          type: 'text' as const,
          text: `--- Imagem ${i + 1} ---\nTítulo: ${String(entry.title || 'N/A').slice(0, 180)}\nFonte: ${String(entry.source || 'N/A').slice(0, 220)}`
        },
        { type: 'image_url' as const, image_url: { url: entry.url, detail: 'low' as const } }
      ])
      .flat()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um validador especialista em imagens de produtos de supermercado/varejo brasileiro. 
Analise as imagens candidatas e determine qual melhor corresponde ao produto descrito.

CRITÉRIOS DE AVALIAÇÃO (em ordem de importância):
1. A imagem mostra a EMBALAGEM real do produto (não uma foto genérica ou banner publicitário)
2. A MARCA na embalagem corresponde à marca informada
3. O PESO/VOLUME/GRAMATURA deve bater exatamente quando informado (ex.: 500ml != 1L, 12x500ml != 6x1L)
4. O SABOR/VARIANTE corresponde (se aplicável)
5. A imagem tem boa qualidade e mostra o produto claramente
6. Tolere pequenos erros de digitação no texto de entrada (OCR/typos), desde que embalagem/marca/gramatura visuais indiquem o mesmo produto.

Responda EXCLUSIVAMENTE em JSON:
{
  "bestIndex": <numero da melhor imagem (1-based), ou -1 se NENHUMA corresponde>,
  "confidence": <0.0 a 1.0>,
  "isExactMatch": <true|false>,
  "mismatchReasons": ["<lista curta de motivos de rejeicao>"],
  "reason": "<explicacao curta em portugues>"
}`
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Produto: ${productDescription}\n\nQual destas imagens melhor representa este produto?` },
            ...imageContents
          ]
        }
      ]
    })

    const content = response.choices?.[0]?.message?.content
    if (!content) {
      return {
        bestIndex: 0,
        confidence: 0.3,
        reason: 'Sem resposta da IA',
        isExactMatch: false,
        mismatchReasons: ['empty_ai_response']
      }
    }

    const parsed = JSON.parse(content)
    const bestIndex = typeof parsed.bestIndex === 'number'
      ? (parsed.bestIndex === -1 ? -1 : parsed.bestIndex - 1)
      : 0
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
    const isExactMatch = !!parsed.isExactMatch
    const mismatchReasons = Array.isArray(parsed.mismatchReasons)
      ? parsed.mismatchReasons.map((item: any) => String(item || '').trim()).filter(Boolean).slice(0, 6)
      : []
    const reason = parsed.reason || ''

    console.log(`🤖 [AI Validate] Produto: "${productInfo.name}" | Melhor: imagem ${bestIndex + 1}/${candidates.length} | Exata=${isExactMatch} | Confiança: ${(confidence * 100).toFixed(0)}% | ${reason}`)
    return { bestIndex, confidence, reason, isExactMatch, mismatchReasons }
  } catch (err: any) {
    console.warn('⚠️ [AI Validate] Falha na validação por IA:', err?.message)
    return {
      bestIndex: -1,
      confidence: 0,
      reason: 'IA indisponível para validação estrita',
      isExactMatch: false,
      mismatchReasons: ['ai_unavailable']
    }
  }
}
