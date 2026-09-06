export type StoreDynamicFieldKind = 'text' | 'logo' | 'validity'

export type StoreDynamicField = {
  id: string
  field: string
  label: string
  sample: string
  kind: StoreDynamicFieldKind
  fontSize: number
  fontWeight: number | string
  tags: string[]
  preview: string
}

export const STORE_DYNAMIC_FIELDS: StoreDynamicField[] = [
  {
    id: 'store-logo',
    field: 'logo',
    label: 'Logo da loja',
    sample: 'LOGO',
    kind: 'logo',
    fontSize: 18,
    fontWeight: 700,
    tags: ['logo', 'marca', 'loja'],
    preview: '<rect x="8" y="12" width="32" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="22" r="3" fill="currentColor"/><path d="M10,32 L20,24 L28,30 L40,20" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-name',
    field: 'companyName',
    label: 'Nome da loja',
    sample: 'Sua loja',
    kind: 'text',
    fontSize: 36,
    fontWeight: 800,
    tags: ['nome', 'loja', 'empresa'],
    preview: '<text x="24" y="30" fill="currentColor" font-size="11" font-weight="800" text-anchor="middle">LOJA</text>'
  },
  {
    id: 'store-slogan',
    field: 'slogan',
    label: 'Slogan',
    sample: 'Seu slogan aqui',
    kind: 'text',
    fontSize: 18,
    fontWeight: 600,
    tags: ['slogan', 'frase'],
    preview: '<text x="24" y="28" fill="currentColor" font-size="8" text-anchor="middle">slogan</text>'
  },
  {
    id: 'store-validity',
    field: 'validity',
    label: 'Validade das ofertas',
    sample: 'Ofertas válidas de 01/04 a 07/04',
    kind: 'validity',
    fontSize: 16,
    fontWeight: 600,
    tags: ['validade', 'data', 'periodo'],
    preview: '<text x="24" y="28" fill="currentColor" font-size="8" text-anchor="middle">datas</text>'
  },
  {
    id: 'store-whatsapp',
    field: 'whatsapp',
    label: 'WhatsApp',
    sample: '(11) 99999-9999',
    kind: 'text',
    fontSize: 16,
    fontWeight: 700,
    tags: ['whatsapp', 'telefone', 'contato'],
    preview: '<rect x="10" y="12" width="28" height="24" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-phone',
    field: 'phone',
    label: 'Telefone',
    sample: '(11) 3333-4444',
    kind: 'text',
    fontSize: 16,
    fontWeight: 700,
    tags: ['telefone', 'fone', 'contato'],
    preview: '<rect x="14" y="8" width="20" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-address',
    field: 'address',
    label: 'Endereço',
    sample: 'Rua da loja, 100',
    kind: 'text',
    fontSize: 14,
    fontWeight: 500,
    tags: ['endereco', 'rua', 'loja'],
    preview: '<path d="M24,8 L38,22 V38 H10 V22 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="4" fill="currentColor"/>'
  },
  {
    id: 'store-hours',
    field: 'hours',
    label: 'Horário',
    sample: 'Seg a sáb, 8h às 20h',
    kind: 'text',
    fontSize: 14,
    fontWeight: 500,
    tags: ['horario', 'funcionamento'],
    preview: '<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M24,14 V24 L32,28" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-instagram',
    field: 'instagram',
    label: 'Instagram',
    sample: '@sualoja',
    kind: 'text',
    fontSize: 14,
    fontWeight: 600,
    tags: ['instagram', 'social'],
    preview: '<rect x="10" y="10" width="28" height="28" rx="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-facebook',
    field: 'facebook',
    label: 'Facebook',
    sample: 'Sua Loja',
    kind: 'text',
    fontSize: 14,
    fontWeight: 600,
    tags: ['facebook', 'social'],
    preview: '<text x="24" y="32" fill="currentColor" font-size="22" font-weight="800" text-anchor="middle">f</text>'
  },
  {
    id: 'store-website',
    field: 'website',
    label: 'Site',
    sample: 'www.sualoja.com.br',
    kind: 'text',
    fontSize: 14,
    fontWeight: 500,
    tags: ['site', 'url', 'web'],
    preview: '<circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="24" cy="24" rx="6" ry="14" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-payments',
    field: 'paymentMethods',
    label: 'Formas de pagamento',
    sample: 'PIX · Visa · Mastercard',
    kind: 'text',
    fontSize: 13,
    fontWeight: 600,
    tags: ['pagamento', 'pix', 'cartao'],
    preview: '<rect x="6" y="16" width="36" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>'
  },
  {
    id: 'store-payment-notes',
    field: 'paymentNotes',
    label: 'Observação de pagamento',
    sample: 'Consulte condições',
    kind: 'text',
    fontSize: 12,
    fontWeight: 500,
    tags: ['pagamento', 'obs', 'nota'],
    preview: '<path d="M10,12 H38 V36 H10 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16,20 H32 M16,26 H28" stroke="currentColor" stroke-width="2"/>'
  }
]
