import type { ArtTemplate, ArtLayer, ArtComposition } from '~/types/art-studio'

const variants = [
  [
    'Dia do Cliente',
    'Datas comemorativas',
    'Seu cliente em primeiro lugar',
    'VOCÊ FAZ\nPARTE DA\nNOSSA HISTÓRIA.',
    'Obrigado por escolher estar com a gente.',
    '#173f35',
    '#eff8cb',
    'heart'
  ],
  [
    'Primavera chegou',
    'Datas comemorativas',
    'Novos começos',
    'TEMPO DE\nFLORESCER.',
    'Novas cores. Novas possibilidades.',
    '#ede5f5',
    '#703f89',
    'flower'
  ],
  [
    'Dia das Crianças',
    'Datas comemorativas',
    'Pequenas alegrias',
    'BRINCAR É\nCOISA SÉRIA.',
    'Celebre os melhores momentos em família.',
    '#fae785',
    '#be462d',
    'star'
  ],
  [
    'Black Friday',
    'Campanhas',
    'Grandes oportunidades',
    'PREPARE-SE\nPARA O\nEXTRAORDINÁRIO.',
    'Uma seleção especial espera por você.',
    '#202323',
    '#dcff85',
    'bolt'
  ],
  [
    'Semana especial',
    'Campanhas',
    'Grandes oportunidades',
    'ESSA SEMANA\nTEM MAIS.',
    'Surpresas que merecem fazer parte do seu dia.',
    '#cae5f2',
    '#184f6b',
    'star'
  ],
  [
    'Obrigado pela preferência',
    'Mensagens',
    'Seu cliente em primeiro lugar',
    'NOSSO MELHOR\nCOMEÇA\nCOM VOCÊ.',
    'Obrigado por fazer parte da nossa história.',
    '#f2d7c7',
    '#823d32',
    'heart'
  ],
  [
    'Bom dia',
    'Mensagens',
    'Pequenas alegrias',
    'QUE HOJE\nSEJA LEVE.',
    'Um novo dia para viver coisas boas.',
    '#fcf1d6',
    '#8a5a24',
    'flower'
  ],
  [
    'Horário de atendimento',
    'Informativos',
    'Sua loja informa',
    'ESTAMOS\nESPERANDO\nPOR VOCÊ.',
    'Segunda a sábado • 8h às 18h',
    '#dcebe0',
    '#31594b',
    'check'
  ],
  [
    'Comunicado importante',
    'Informativos',
    'Sua loja informa',
    'UM RECADO\nIMPORTANTE.',
    'Escreva aqui o que seus clientes precisam saber.',
    '#e4e2f2',
    '#4f447a',
    'bolt'
  ],
  [
    'Seja bem-vindo',
    'Sinalização',
    'Sua loja informa',
    'ENTRE.\nA CASA\nÉ SUA.',
    'É sempre bom receber você.',
    '#24473d',
    '#f1ddac',
    'heart'
  ],
  [
    'Conheça nossa loja',
    'Divulgação',
    'Sua marca presente',
    'PERTO\nDE VOCÊ.\nTODO DIA.',
    'Qualidade e cuidado em cada detalhe.',
    '#e7eee8',
    '#245547',
    'star'
  ],
  [
    'Peça pelo WhatsApp',
    'Divulgação',
    'Sua marca presente',
    'SEU PEDIDO\nA UM TOQUE.',
    'Fale com a gente e receba todas as novidades.',
    '#d4e7bd',
    '#305735',
    'check'
  ]
] as const

export const ART_STARTER_TEMPLATES: ArtTemplate[] = variants.map((v, i) => {
  const [name, category, collection, title, subtitle, bg, fg, icon] = v
  const base = (
    id: string,
    kind: ArtLayer['kind'],
    x: number,
    y: number,
    width: number,
    height: number
  ): ArtLayer => ({
    id,
    kind,
    name: id,
    x,
    y,
    width,
    height,
    rotation: 0,
    fill: fg,
    opacity: 1,
    locked: false,
    visible: true
  })
  const composition: ArtComposition = {
    version: 1,
    width: 1080,
    height: 1350,
    background: bg,
    layers: [
      {
        ...base('Círculo decorativo', 'shape', 650, -100, 600, 600),
        shape: 'ellipse',
        opacity: 0.12
      },
      { ...base('Linha decorativa', 'shape', 80, 300, 85, 10), shape: 'rect' },
      {
        ...base('Selo', 'icon', 770, 180, 200, 200),
        icon,
        rotation: i % 2 ? 12 : -12
      },
      {
        ...base('Tema', 'text', 80, 95, 710, 100),
        text: name.toLocaleUpperCase('pt-BR'),
        fontFamily: 'Barlow',
        fontSize: 28,
        fontWeight: 600,
        align: 'left'
      },
      {
        ...base('Título', 'text', 80, 390, 910, 470),
        text: title,
        fontFamily: i % 3 === 0 ? 'Barlow Condensed' : 'Barlow',
        fontSize: 112,
        fontWeight: 800,
        align: 'left'
      },
      {
        ...base('Mensagem', 'text', 85, 890, 760, 130),
        text: subtitle,
        fontFamily: 'Barlow',
        fontSize: 38,
        fontWeight: 400,
        align: 'left'
      },
      {
        ...base('Nome da empresa', 'text', 85, 1170, 560, 65),
        text: 'Sua empresa',
        fontFamily: 'Barlow',
        fontSize: 30,
        fontWeight: 600,
        align: 'left',
        binding: 'companyName'
      },
      {
        ...base('Instagram', 'text', 85, 1235, 570, 55),
        text: '@suaempresa',
        fontFamily: 'Barlow',
        fontSize: 24,
        fontWeight: 400,
        align: 'left',
        binding: 'instagram'
      },
      {
        ...base('Logo', 'image', 785, 1150, 205, 140),
        src: '',
        fit: 'contain',
        binding: 'logo'
      }
    ]
  }
  return {
    id: `starter-${i + 1}`,
    name,
    category,
    collection,
    tags: [name, collection],
    composition,
    published: true,
    revision: 1
  }
})
