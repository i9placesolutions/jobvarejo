import type { AiGeneratePayload } from './aiTypes'

const sanitize = (value: unknown) => String(value || '').trim()

export const buildAiCanvasPrompt = (payload: AiGeneratePayload): string => {
  const width = Math.max(1, Math.round(Number(payload?.options?.size?.width || 1080)))
  const height = Math.max(1, Math.round(Number(payload?.options?.size?.height || 1920)))
  const pageType = sanitize(payload?.options?.pageType || 'RETAIL_OFFER')
  const hasReferenceImage = !!sanitize(payload?.options?.referenceImageDataUrl)
  const cloneStrength = Math.max(0, Math.min(100, Math.round(Number(payload?.options?.cloneStrength ?? 100))))
  const stylePrompt = sanitize(
    payload?.prompt || (hasReferenceImage ? 'Clonar o layout da imagem de referencia com maxima fidelidade.' : 'Encarte promocional moderno')
  )

  return [
    'Voce e um gerador de JSON para Fabric.js v7.1.0.',
    'Retorne SOMENTE JSON valido, sem markdown, sem texto extra.',
    '',
    'Formato obrigatório:',
    '{',
    '  "version": "7.1.0",',
    '  "objects": [ ... ]',
    '}',
    '',
    `Pagina alvo: ${width}x${height}px`,
    `Tipo da página: ${pageType}`,
    '',
    'Regras obrigatórias:',
    '1) Sempre incluir um frame de fundo como objeto retangular com exatamente estes campos:',
    `   {"type":"Rect","name":"Frame 1","isFrame":true,"layerName":"FRAMER","left":0,"top":0,"width":${width},"height":${height},"fill":"#ffffff","selectable":false,"evented":false}`,
    '2) Os demais objetos devem ser compativeis com Fabric (Textbox, Rect, Circle, Line, Path, etc.).',
    '3) Nao usar imagens externas (http/https). Para area de imagem use placeholder em Rect + Textbox.',
    '4) Em textos, usar uma tipografia visualmente proxima da referencia. Se nao for possivel inferir, usar "Inter".',
    '5) Evitar propriedades desnecessarias e objetos vazios.',
    ...(hasReferenceImage
      ? [
          '',
          `Referencia visual anexada: SIM (fidelidade alvo ${cloneStrength}%).`,
          'Priorize reproduzir estrutura, hierarquia, espacamentos, cores, alinhamento, tamanhos e copy com alta fidelidade.',
          'Se houver textos legiveis na referencia, preserve o mesmo texto.',
          'Mantenha saida limpa e editavel no Fabric.'
        ]
      : []),
    '',
    'Tema/estilo solicitado:',
    stylePrompt
  ].join('\n')
}
